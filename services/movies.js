// services/movies.js
const { envVar } = require('./env');
const storage = require('./storage');

/** Build "movies" root (optionally with user subfolder). Always ends with "/" */
function getMoviesFolder(subFolder = null) {
  const base = String(envVar('MOVIES_FOLDER') || 'movies').replace(/^\/+|\/+$/g, '');
  if (!subFolder && subFolder !== 0) return `${base}/`;
  const child = String(subFolder).replace(/^\/+|\/+$/g, '');
  return `${base}/${child}/`;
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
      } catch { /* noop */ }
    }

    // Remove leading slash and decode (%20, etc)
    key = key.replace(/^\/+/, '');
    try { key = decodeURIComponent(key); } catch { /* noop */ }

    // Replace form-encoded '+' with space
    key = key.replace(/\+/g, ' ');

    // Drop leading "uploads/" if present
    if (key.toLowerCase().startsWith('uploads/')) key = key.slice('uploads/'.length);

    // If the path still includes moviesFolder, remove that prefix too
    const mf = String(moviesFolder || '').replace(/^\/+|\/+$/g, ''); // e.g. "movies/123"
    if (mf) {
      const idx = key.toLowerCase().indexOf((mf + '/').toLowerCase());
      if (idx >= 0) key = key.slice(idx + mf.length + 1);
      if (key.toLowerCase().startsWith(mf.toLowerCase())) key = key.slice(mf.length);
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
      folderContent.files.forEach((keyFull) => {
        const key = String(keyFull);

        // When listing the ROOT (subFolder === null), only include immediate children.
        if (subFolder === null) {
          const rel = key.startsWith(moviesFolderPath) ? key.slice(moviesFolderPath.length) : key;
          if (rel.includes('/')) return; // skip nested keys (e.g., user folders)
        }

        const fileName = key.split('/').pop();
        const fileExt = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
        if (!fileName || !fileExt || !validExt.includes(fileExt)) return;

        files.push({
          name: fileName,
          url: storage.movieFilePublicUrl(key, subFolder),
          subFolder,
          deletable: true, // allow delete everywhere (root and user folders)
        });
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
    const moviesFolder = getMoviesFolder(subFolder);      // e.g. "movies/123/"
    const rel = normalizeKey(fileName, moviesFolder);     // e.g. "My File.mp4"
    const abs = `${moviesFolder}${rel}`.replace(/\/{2,}/g, '/'); // "movies/123/My File.mp4"

    if (process.env.DEBUG_DELETE === '1') {
      console.log('[movies.delete] input=', fileName);
      console.log('[movies.delete] moviesFolder=', moviesFolder);
      console.log('[movies.delete] relKey=', rel);
      console.log('[movies.delete] absKey=', abs);
    }

    // Try absolute key first (full path including MOVIES_FOLDER/subFolder)
    let ok = false;
    try {
      const r1 = await storage.deleteFile({ filePath: abs });
      ok = r1?.success !== false;
      if (process.env.DEBUG_DELETE === '1') console.log('[movies.delete] abs result=', r1);
    } catch (e) {
      if (process.env.DEBUG_DELETE === '1') console.log('[movies.delete] abs threw:', e?.message);
    }

    // If that didn't work, try relative key (just the file inside moviesFolder)
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
  getMoviesList,
  deleteMovieFile,
  createUserMoviesFolder: async (userId) => storage.createFolder({ folderPath: getMoviesFolder(userId) }),
};
