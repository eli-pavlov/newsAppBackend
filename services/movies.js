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

    // If full URL, keep only the path
    if (/^https?:\/\//i.test(key)) {
      try {
        const u = new URL(key);
        key = u.pathname || key;
      } catch (_) {}
    }

    // Remove leading slash and decode
    key = key.replace(/^\/+/, '');
    try { key = decodeURIComponent(key); } catch (_) {}

    // Form-encoded '+' to space (common when names were encoded)
    key = key.replace(/\+/g, ' ');

    // Drop leading "uploads/" if present
    if (key.toLowerCase().startsWith('uploads/')) key = key.slice('uploads/'.length);

    // If the path still includes moviesFolder, remove that prefix too
    const mf = String(moviesFolder || '').replace(/^\/+|\/+$/g, ''); // e.g. "uploads/movies/john"
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

/** Delete a file by normalizing to the exact S3 key, then trying abs and rel keys */
async function deleteMovieFile(fileName, subFolder) {
  try {
    const moviesFolder = getMoviesFolder(subFolder);      // e.g. "uploads/movies/john/"
    const rel = normalizeKey(fileName, moviesFolder);     // e.g. "My File.mp4" or "john/My File.mp4" → "My File.mp4"
    const abs = `${moviesFolder}${rel}`.replace(/\/{2,}/g, '/'); // "uploads/movies/john/My File.mp4"

    if (process.env.DEBUG_DELETE === '1') {
      console.log('[movies.delete] input=', fileName);
      console.log('[movies.delete] moviesFolder=', moviesFolder);
      console.log('[movies.delete] relKey=', rel);
      console.log('[movies.delete] absKey=', abs);
    }

    // Try absolute key first (full path including MOVIES_FOLDER)
    let ok = false;
    try {
      const r1 = await storage.deleteFile({ filePath: abs });
      // treat undefined as OK (many adapters return nothing on success)
      ok = r1?.success !== false;
      if (process.env.DEBUG_DELETE === '1') console.log('[movies.delete] abs result=', r1);
    } catch (e) {
      if (process.env.DEBUG_DELETE === '1') console.log('[movies.delete] abs threw:', e?.message);
    }

    // If that didn't work, try relative key (relative to MOVIES_FOLDER)
    if (!ok) {
      try {
        const r2 = await storage.deleteFile({ filePath: rel });
        ok = r2?.success !== false;
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
