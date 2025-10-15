// services/movies.js
const { envVar } = require('../services/env');
const storage = require('../services/storage');

function getMoviesFolder(subFolder = null) {
  const moviesFolder = String(envVar('MOVIES_FOLDER') || '').replace(/\/+$/, '');
  return subFolder ? `${moviesFolder}/${String(subFolder).replace(/^\/+|\/+$/g, '')}/` : `${moviesFolder}/`;
}

async function createUserMoviesFolder(userId) {
  const folderPath = getMoviesFolder(userId);
  await storage.createFolder({ folderPath });
}

function normalizeKey(input, moviesFolder) {
  try {
    let key = String(input || '').trim();
    if (/^https?:\/\//i.test(key)) {
      try { key = new URL(key).pathname || key; } catch (_) {}
    }
    key = key.replace(/^\/+/, '');
    try { key = decodeURIComponent(key); } catch (_) {}
    key = key.replace(/\+/g, ' ');
    if (key.toLowerCase().startsWith('uploads/')) key = key.slice('uploads/'.length);

    const mf = String(moviesFolder || '').replace(/^\/+|\/+$/g, '');
    if (mf) {
      const idx = key.toLowerCase().indexOf((mf + '/').toLowerCase());
      if (idx >= 0) key = key.slice(idx + mf.length + 1);
    }
    return key.replace(/^\/+/, '');
  } catch {
    return String(input || '').trim();
  }
}

async function getFolderMoviesList(subFolder = null) {
  try {
    const moviesFolderPath = getMoviesFolder(subFolder);
    const folderContent = await storage.getFolderContent({ folderPath: moviesFolderPath });

    const files = [];
    const validExt = String(envVar('MOVIES_EXT') || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (folderContent?.success && Array.isArray(folderContent.files)) {
      folderContent.files.forEach((k) => {
        const fileName = String(k).split('/').pop();
        const fileExt = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
        if (fileName && fileExt && validExt.includes(fileExt)) {
          files.push({
            name: fileName,
            url: storage.movieFilePublicUrl(k, subFolder),
            subFolder,
            deletable: subFolder !== null, // only user files are deletable
          });
        }
      });
    }
    return files;
  } catch (e) {
    console.log('[movies.list] error:', e.message);
    return [];
  }
}

async function getMoviesList(userId) {
  const commonMovies = await getFolderMoviesList(null);
  const userMovies = await getFolderMoviesList(userId);
  return [...commonMovies, ...userMovies];
}

async function deleteMovieFile(fileName, subFolder) {
  try {
    const moviesFolder = getMoviesFolder(subFolder);  // e.g. "movies/1/" or "movies/"
    const rel = normalizeKey(fileName, moviesFolder); // e.g. "My File.mp4"
    const abs = `${moviesFolder}${rel}`.replace(/\/{2,}/g, '/');

    if (process.env.DEBUG_DELETE === '1') {
      console.log('[movies.delete] input=', fileName);
      console.log('[movies.delete] moviesFolder=', moviesFolder);
      console.log('[movies.delete] relKey=', rel);
      console.log('[movies.delete] absKey=', abs);
    }

    // Try absolute (with user subfolder when provided)
    let ok = false;
    try {
      const r1 = await storage.deleteFile({ filePath: abs });
      ok = r1?.success === true;
      if (process.env.DEBUG_DELETE === '1') console.log('[movies.delete] abs result=', r1);
    } catch (e) {
      if (process.env.DEBUG_DELETE === '1') console.log('[movies.delete] abs threw:', e?.message);
    }

    // Fallback: try root (common)
    if (!ok) {
      try {
        const rootFolder = getMoviesFolder(null); // "movies/"
        const rootAbs = `${rootFolder}${rel}`.replace(/\/{2,}/g, '/');
        const r2 = await storage.deleteFile({ filePath: rootAbs });
        ok = r2?.success === true;
        if (process.env.DEBUG_DELETE === '1') console.log('[movies.delete] root result=', r2);
      } catch (e) {
        if (process.env.DEBUG_DELETE === '1') console.log('[movies.delete] root threw:', e?.message);
      }
    }

    return { success: ok };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

module.exports = {
  getMoviesFolder,
  createUserMoviesFolder,
  getMoviesList,
  deleteMovieFile,
};
