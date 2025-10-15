// services/movies.js (or the path where this module lives)

const { envVar } = require('../services/env');
const storage = require('../services/storage');

/** Build "movies" root (optionally with user subfolder). Always ends with "/" */
function getMoviesFolder(subFolder = null) {
  const moviesFolder = String(envVar('MOVIES_FOLDER') || '').replace(/\/+$/, '');
  return subFolder ? `${moviesFolder}/${subFolder.replace(/^\/+|\/+$/g, '')}/` : `${moviesFolder}/`;
}

async function createUserMoviesFolder(userId) {
  const folderPath = getMoviesFolder(userId);
  await storage.createFolder({ folderPath });
}

/** internal helper: normalize client-provided identifier (URL/path/name) to a key relative to moviesFolder */
function normalizeKey(input, moviesFolder) {
  try {
    let key = String(input || '').trim();

    // If a full URL was provided, keep only the path part
    if (/^https?:\/\//i.test(key)) {
      try {
        const u = new URL(key);
        key = u.pathname || key;
      } catch (_) {}
    }

    // Remove leading slash and decode percent-encoding
    key = key.replace(/^\/+/, '');
    try { key = decodeURIComponent(key); } catch (_) {}

    // Convert '+' to space (common when names were form-encoded)
    key = key.replace(/\+/g, ' ');

    // Drop leading "uploads/" if present (we'll add our own root below)
    if (key.toLowerCase().startsWith('uploads/')) {
      key = key.slice('uploads/'.length);
    }

    // If the path still contains the moviesFolder prefix (with/without uploads), cut it away
    const mf = String(moviesFolder || '').replace(/^\/+|\/+$/g, ''); // e.g., "uploads/movies/john"
    if (mf) {
      const idx = key.toLowerCase().indexOf((mf + '/').toLowerCase());
      if (idx >= 0) key = key.slice(idx + mf.length + 1);
    }

    // Final cleanup: remove any accidental leading slashes
    return key.replace(/^\/+/, '');
  } catch {
    return String(input || '').trim();
  }
}

/** list files from the (optional) subFolder */
async function getFolderMoviesList(subFolder = null) {
  try {
    const moviesFolderPath = getMoviesFolder(subFolder); // always ends with "/"
    const folderContent = await storage.getFolderContent({ folderPath: moviesFolderPath });

    const files = [];
    const validExt = String(envVar('MOVIES_EXT') || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (folderContent?.success && Array.isArray(folderContent.files)) {
      folderContent.files.forEach((f) => {
        // BUGFIX: use "f", not "af"
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

/** union of common movies + user movies */
async function getMoviesList(userId) {
  // BUGFIX: call the local function directly; "this.getFolderMoviesList" is not exported
  const commonMovies = await getFolderMoviesList();
  const userMovies = await getFolderMoviesList(userId);
  return [...commonMovies, ...userMovies];
}

/** delete a file by normalizing to the exact S3 key used for upload */
async function deleteMovieFile(fileName, subFolder) {
  try {
    const moviesFolder = getMoviesFolder(subFolder); // e.g., "uploads/movies/john/"
    const rel = normalizeKey(fileName, moviesFolder);
    const filePath = `${moviesFolder}${rel}`.replace(/\/{2,}/g, '/'); // avoid accidental double slashes

    // Optional trace to confirm the exact key being deleted
    if (process.env.DEBUG_DELETE === '1') {
      console.log('[movies.delete] moviesFolder=', moviesFolder, 'input=', fileName, 'rel=', rel, 'final=', filePath);
    }

    await storage.deleteFile({ filePath });
    return { success: true };
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
