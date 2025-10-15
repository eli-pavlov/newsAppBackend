// services/movies.js

const { envVar } = require('../services/env');
const storage = require('../services/storage');

/** Build "movies" root (optionally with user subfolder). Always ends with "/" */
function getMoviesFolder(subFolder = null) {
  const moviesFolder = String(envVar('MOVIES_FOLDER') || '').replace(/\/+$/, '');
  return subFolder ? `${moviesFolder}/${String(subFolder).replace(/^\/+|\/+$/g, '')}/` : `${moviesFolder}/`;
}

async function createUserMoviesFolder(userId) {
  const folderPath = getMoviesFolder(userId);
  await storage.createFolder({ folderPath });
}

/** Normalize client-provided identifier (URL/path/name) to a key relative to moviesFolder */
function normalizeKey(input, moviesFolder) {
  try {
    let key = String(input || '').trim();

    if (/^https?:\/\//i.test(key)) {
      try {
        const u = new URL(key);
        key = u.pathname || key;
      } catch (_) {}
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

/** List files from the (optional) subFolder */
async function getFolderMoviesList(subFolder = null) {
  try {
    const moviesFolderPath = getMoviesFolder(subFolder); // ends with "/"
    const folderContent = await storage.getFolderContent({ folderPath: moviesFolderPath });

    const files = [];
    const validExt = String(envVar('MOVIES_EXT') || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (folderContent?.success && Array.isArray(folderContent.files)) {
      folderContent.files.forEach((f) => {
        const fileName = String(f).split('/').pop();
        const fileExt = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
        if (fileName && fileExt && validExt.includes(fileExt)) {
          files.push({
            name: fileName,
            url: storage.movieFilePublicUrl(f, subFolder),
            subFolder,
            deletable: subFolder !== null,
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

/** Union of common movies + user movies */
async function getMoviesList(userId) {
  const commonMovies = await getFolderMoviesList();
  const userMovies = await getFolderMoviesList(userId);
  return [...commonMovies, ...userMovies];
}

/** Delete: try ABSOLUTE key first (includes user subfolder), then RELATIVE. */
async function deleteMovieFile(fileName, subFolder) {
  try {
    const moviesFolder = getMoviesFolder(subFolder);  // e.g. "movies/1/"
    const rel = normalizeKey(fileName, moviesFolder); // e.g. "1.5MB video.mp4"
    const abs = `${moviesFolder}${rel}`.replace(/\/{2,}/g, '/'); // "movies/1/1.5MB video.mp4"

    if (process.env.DEBUG_DELETE === '1') {
      console.log('[movies.delete] input=', fileName);
      console.log('[movies.delete] moviesFolder=', moviesFolder);
      console.log('[movies.delete] relKey=', rel);
      console.log('[movies.delete] absKey=', abs);
    }

    // Absolute first
    let ok = false;
    try {
      const r1 = await storage.deleteFile({ filePath: abs });
      ok = r1?.success === true;
      if (process.env.DEBUG_DELETE === '1') console.log('[movies.delete] abs result=', r1);
    } catch (e) {
      if (process.env.DEBUG_DELETE === '1') console.log('[movies.delete] abs threw:', e?.message);
    }

    // Then relative (for compatibility with any old uploads under root)
    if (!ok) {
      try {
        const r2 = await storage.deleteFile({ filePath: rel });
        ok = r2?.success === true;
        if (process.env.DEBUG_DELETE === '1') console.log('[movies.delete] rel result=', r2);
      } catch (e) {
        if (process.env.DEBUG_DELETE === '1') console.log('[movies.delete] rel threw:', e?.message);
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
