'use strict';

/**
 * services/movies.js
 * Centralised helpers for listing and deleting movie files across both legacy (flat)
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
 * List all object keys under the movies area (recursively).
 * Returns: { success, files: [ 'movies/1/foo.mp4', 'movies/movie1.mp4', ... ] }
 */
async function listAllMoviesKeys() {
  const folderPath = getMoviesFolder(null);
  const res = await storage.getFolderContent({ folderPath });
  // Normalise shape from different storage backends
  if (res && res.success && Array.isArray(res.files)) {
    return res;
  }
  // Fallback: some implementations might return { success, content }
  if (res && res.success && Array.isArray(res.content)) {
    return { success: true, files: res.content };
  }
  return { success: false, message: (res && res.message) || 'Unable to list folder content' };
}

/**
 * Find the exact S3/Disk key for a given file name. Works with both layouts.
 * If userId is provided, prefer that match; otherwise search all users and legacy root.
 */
async function findExactKeyForName(fileName, userId = null) {
  const base = path.basename(String(fileName));
  const moviesRoot = getMoviesFolder(null);

  // 1) Direct legacy candidate
  const legacyKey = moviesRoot + base;

  // 2) Per-user candidate (if we know the user)
  const perUserKey = userId ? (moviesRoot + String(userId).trim() + '/' + base) : null;

  // Fast path: try given key if caller already passed a path-like value
  const asGiven = String(fileName).includes('/') ? String(fileName).replace(/^\//, '') : null;

  // Pull index of all keys under movies/
  const list = await listAllMoviesKeys();
  if (!list.success) {
    return { success: false, message: list.message || 'Failed to read movie folder' };
  }
  const keys = list.files || [];

  // Prefer exact-as-given (if present)
  if (asGiven && keys.includes(asGiven)) {
    return { success: true, key: asGiven };
  }

  // Prefer per-user match when known
  if (perUserKey && keys.includes(perUserKey)) {
    return { success: true, key: perUserKey };
  }

  // Legacy flat match
  if (keys.includes(legacyKey)) {
    return { success: true, key: legacyKey };
  }

  // Generic search: any key that ends with "/<base>"
  const suffix = '/' + base;
  const generic = keys.find(k => k.endsWith(suffix));
  if (generic) {
    return { success: true, key: generic };
  }

  // Not found
  return { success: false, message: `File not found under ${moviesRoot}: ${base}` };
}

/**
 * Delete movie file by accepting either:
 *  - req-provided absolute key (e.g. 'movies/1/foo.mp4')
 *  - bare file name (e.g. 'foo.mp4'), with optional userId hint
 * Returns: { success, key }
 */
async function deleteMovieFile({ name = null, file_name = null, key = null, filePath = null, userId = null } = {}) {
  try {
    const provided = key || filePath || name || file_name;
    if (!provided) {
      return { success: false, message: 'No file key/name provided' };
    }

    // Try to resolve to an absolute key
    const resolved = await findExactKeyForName(provided, userId);
    if (!resolved.success) {
      return resolved;
    }

    const absKey = resolved.key;

    // Log-friendly
    if (process && process.stdout) {
      console.log('[movies.delete] input=', provided);
      console.log('[movies.delete] moviesFolder=', getMoviesFolder(null));
      console.log('[movies.delete] absKey=', absKey);
    }

    const result = await storage.deleteFile({ filePath: absKey });
    if (result && result.success) {
      return { success: true, key: absKey };
    }
    return { success: false, message: (result && result.message) || 'Delete failed', key: absKey };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/**
 * Optional helper to expose list (kept compatible with any existing callers).
 */
async function getMoviesList(subFolder = null) {
  const folderPath = getMoviesFolder(subFolder);
  return storage.getFolderContent({ folderPath });
}

async function createUserMoviesFolder(userId) {
  const folderPath = getMoviesFolder(userId);
  return storage.createFolder({ folderPath });
}

module.exports = {
  getMoviesFolder,
  createUserMoviesFolder,
  getMoviesList,
  deleteMovieFile,
  // test helpers
  _findExactKeyForName: findExactKeyForName,
  _listAllMoviesKeys: listAllMoviesKeys,
};
