const fs = require('fs/promises');
const { envVar } = require('../services/env');
const storage = require('../services/storage');

getMoviesFolder = function (subFolder = null) {
    const moviesFolder = envVar('MOVIES_FOLDER');

    return `${moviesFolder}/${subFolder ? subFolder + '/' : ''}`;
}

createUserMoviesFolder = async function (userId) {
    const folderPath = getMoviesFolder(userId);

    await storage.createFolder({ folderPath: folderPath });
}

getFolderMoviesList = async function (subFolder = null) {
    try {
        const moviesFolderPath = getMoviesFolder(subFolder);

        const folderContent = await storage.getFolderContent({ folderPath: moviesFolderPath });

        let files = []
        const validExt = envVar("MOVIES_EXT").split(",");

        if (folderContent.success) {
            folderContent.files.forEach(f => {
                const fileName = af.split('/').pop();  // get the last splited item
                const fileExt = fileName.split('.').pop();

                if (fileName !== fileExt) {
                    if (validExt.includes(fileExt))
                        files.push(
                            {
                                name: fileName,
                                url: storage.movieFilePublicUrl(f, subFolder),
                                subFolder: subFolder,
                                deletable: (subFolder !== null)
                            }
                        );
                }
            })
        }

        return files;
    }
    catch (e) {
        console.log(e.message);

        return [];
    }
}

getMoviesList = async function (userId) {
    let commonMovies = await this.getFolderMoviesList();

    let userMovies = await getFolderMoviesList(userId);

    return [...commonMovies, ...userMovies];
}

/**
 * Normalize client-provided file identifier (URL/path/name) to an S3 key
 * relative to the movies folder.
 */
function normalizeKey(input, moviesFolder) {
    try {
        let key = String(input || '').trim();

        // If it's a full URL, take the path
        if (/^https?:\/\//i.test(key)) {
            try {
                const u = new URL(key);
                key = u.pathname || key;
            } catch (_) {}
        }

        // Remove leading slash and decode percent-encoding
        key = key.replace(/^\/+/, '');
        try { key = decodeURIComponent(key); } catch (_) {}

        // Drop leading 'uploads/' if present
        if (key.toLowerCase().startsWith('uploads/')) {
            key = key.slice('uploads/'.length);
        }

        // If key already contains the moviesFolder, cut everything up to and including it
        const mf = String(moviesFolder || '').replace(/^\/+|\/+$/g, '');
        if (mf) {
            const pos = key.toLowerCase().indexOf((mf + '/').toLowerCase());
            if (pos >= 0) {
                key = key.slice(pos + mf.length + 1);
            }
        }

        // Final cleanup
        return key.replace(/^\/+/, '');
    } catch (e) {
        return String(input || '').trim();
    }
}

async function deleteMovieFile(fileName, subFolder) {
  // Use the app’s existing helpers/vars:
  const moviesFolder = (typeof getMoviesFolder === 'function')
    ? getMoviesFolder(subFolder)
    : 'movies';

  // --- normalize whatever the UI sent (URL, /uploads/..., movies/..., bare name) to a RELATIVE piece
  let rel = String(fileName || '').trim();

  // If it's a URL, take pathname
  if (/^https?:\/\//i.test(rel)) {
    try { rel = new URL(rel).pathname || rel; } catch (_) {}
  }

  // strip leading slash, decode %2F etc.
  rel = rel.replace(/^\/+/, '');
  try { rel = decodeURIComponent(rel); } catch (_) {}

  // drop leading "uploads/"
  rel = rel.replace(/^uploads\//i, '');

  // drop leading "<moviesFolder>/"
  const mf = String(moviesFolder || 'movies').replace(/^\/+|\/+$/g, '');
  const mfRe = new RegExp('^' + mf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/','i');
  rel = rel.replace(mfRe, '');

  // Build candidate absolute keys to try (covers both layouts you’ve used)
  const candidates = new Set([
    `${mf}/${rel}`,             // movies/abc.mp4
    `uploads/${mf}/${rel}`,     // uploads/movies/abc.mp4
  ]);

  // Space/plus edge cases (harmless to try)
  for (const k of Array.from(candidates)) {
    if (k.includes('+')) candidates.add(k.replace(/\+/g, ' '));
    if (k.includes(' ')) candidates.add(k.replace(/ /g, '+'));
  }

  // Helpful logs (pod logs only)
  console.warn('[files.delete] input=%s mf=%s rel=%s candidates=%j', fileName, mf, rel, Array.from(candidates));

  // Try each candidate with your existing storage adapter call
  for (const key of candidates) {
    try {
      // NOTE: keep the same adapter call you already use here:
      // e.g. await storage.deleteFile(key)
      // If your original code was deleteObject({ Key: key }) or similar, keep that line instead.
      await storage.deleteFile(key);

      console.warn('[files.delete] deleted key=%s', key);
      return { success: true };
    } catch (e) {
      // try next
    }
  }

  console.error('[files.delete] FAILED for input=%s (tried=%j)', fileName, Array.from(candidates));
  return { success: false };
}

module.exports = {
    getMoviesFolder,
    createUserMoviesFolder,
    getMoviesList,
    deleteMovieFile
}
