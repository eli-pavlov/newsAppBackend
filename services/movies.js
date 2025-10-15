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

async function getMoviesList(userId) {
  const commonMovies = await getFolderMoviesList();
  const userMovies = await getFolderMoviesList(userId);
  return [...commonMovies, ...userMovies];
}

async function deleteMovieFile(fileName, subFolder) {
  try {
    const moviesFolder = getMoviesFolder(subFolder);      // e.g. "movies/1/"
    const rel = normalizeKey(fileName, moviesFolder);     // e.g. "My File.mp4"

    if (process.env.DEBUG_DELETE === '1') {
      console.log('[movies.delete] input=', fileName);
      console.log('[movies.delete] moviesFolder=', moviesFolder);
      console.log('[movies.delete] relKey=', rel);
    }

    const r = await storage.deleteFile({ filePath: rel });

    if (process.env.DEBUG_DELETE === '1') {
      console.log('[movies.delete] storage.deleteFile =>', r);
    }

    return { success: !!r?.success };
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
