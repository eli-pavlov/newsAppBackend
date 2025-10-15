'use strict';

/**
 * services/movies.js
 * Helpers for listing and deleting movie files across both legacy (flat)
 * and new (per-user) layouts in S3/Disk.
 *
 * Legacy layout:         movies/<file>
 * New pre-signed layout: movies/<userId>/<file>
 */

const path = require('path').posix;
const { envVar } = require('./env');
const storage = require('./storage');

/** Build "movies" root (optionally with user subfolder). Always ends with "/" */
function getMoviesFolder(subFolder = null) {
  const base = String(envVar('MOVIES_FOLDER') || 'movies').replace(/\/+/g, '/').replace(/\/+$/, '');
  const tail = subFolder ? `/${String(subFolder).replace(/^\/+|\/+$/g, '')}` : '';
  return `${base}${tail}/`;
}

/**
 * Normalise output of storage.getFolderContent to a common shape:
 *  { success, files: [ 'movies/1/foo.mp4', ... ], content: [ {filePath, name, subFolder, deletable, times} ] }
 */
function normaliseFolderList(res, subFolder = null) {
  const out = { success: false, files: [], content: [] };
  if (!res || res.success === false) {
    out.success = false;
    out.message = res && res.message ? res.message : 'Unknown error';
    return out;
  }
  out.success = true;

  // If backend returns array of raw keys (strings)
  if (Array.isArray(res.files) && res.files.every(x => typeof x === 'string')) {
    out.files = res.files.slice();
    out.content = out.files
      .filter(k => k && !k.endsWith('/')) // drop zero-byte folder markers
      .map(k => ({
        filePath: k,
        name: k.split('/').pop(),
        subFolder,
        times: 1,
        deletable: true,
      }));
    return out;
  }

  // If backend uses "content" entries
  if (Array.isArray(res.content)) {
    out.content = res.content.map(item => {
      if (typeof item === 'string') {
        return {
          filePath: item,
          name: item.split('/').pop(),
          subFolder,
          times: 1,
          deletable: true,
        };
      }
      const filePath = item.filePath || item.key || item.path || item.name || '';
      return {
        filePath,
        name: item.name || (filePath ? filePath.split('/').pop() : ''),
        subFolder: item.subFolder ?? subFolder,
        times: item.times ?? 1,
        deletable: item.deletable ?? true,
        ...item,
      };
    });
    out.files = out.content.map(i => i.filePath).filter(Boolean);
    return out;
  }

  // Unknown shape: be forgiving
  return { success: true, files: [], content: [] };
}

/**
 * List files under the movies folder (for a user subfolder or root).
 * Returns normalised shape; never throws.
 */
async function getMoviesList(subFolder = null) {
  try {
    const folderPath = getMoviesFolder(subFolder);
    const res = await storage.getFolderContent({ folderPath });
    return normaliseFolderList(res, subFolder);
  } catch (e) {
    return { success: true, files: [], content: [] }; // never break callers
  }
}

/**
 * Delete movie by trying both layouts. We avoid listing to keep it robust across storage backends:
 *   1) movies/<userId>/<basename>
 *   2) movies/<basename>
 * If caller passes a path-like "key", we delete it directly as well.
 */
async function deleteMovieFile({ name = null, file_name = null, key = null, filePath = null, userId = null } = {}) {
  try {
    const provided = key || filePath || name || file_name;
    if (!provided) return { success: false, message: 'No file key/name provided' };

    const basename = path.basename(String(provided));
    const moviesRoot = getMoviesFolder(null);

    // If the caller already gave us a full key, try it first.
    const candidates = [];
    if (String(provided).includes('/')) {
      candidates.push(String(provided).replace(/^\/+/, ''));
    }
    if (userId) {
      candidates.push(`${moviesRoot}${String(userId).trim()}/${basename}`);
    }
    candidates.push(`${moviesRoot}${basename}`);

    let lastErr = null;
    for (const k of candidates) {
      try {
        const resp = await storage.deleteFile({ filePath: k });
        // Many backends (S3) are idempotent; consider any non-throw as success.
        if (resp == null || (resp && resp.success !== false)) {
          return { success: true, key: k };
        }
      } catch (e) {
        lastErr = e;
      }
    }
    return { success: false, message: lastErr ? lastErr.message : 'Delete failed' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

async function createUserMoviesFolder(userId) {
  const folderPath = getMoviesFolder(userId);
  try {
    await storage.createFolder({ folderPath });
    return { success: true };
  } catch (e) {
    // Do not block login/bootstraps if bucket doesn't support folder creation
    return { success: false, message: e.message };
  }
}

module.exports = {
  getMoviesFolder,
  createUserMoviesFolder,
  getMoviesList,
  deleteMovieFile,
};
