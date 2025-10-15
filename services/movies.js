// services/movies.js

const path = require("path");

// NOTE: keep the same import you already use for your storage adapter.
// If your original file had a different path, keep it.
// Common locations are: "../services/storage", "../utils/storage", "./storage"
const storage = require("../services/storage");

/** Helper: trim slashes */
function trimSlashes(s) {
  return String(s || "").replace(/^\/+|\/+$/g, "");
}

/** Helper: return the folder where movies live (keeps current behavior) */
function getMoviesFolder(subFolder) {
  // If your project already has this function, keep that one.
  // Fallback default:
  const base = "movies";
  if (!subFolder) return base;
  return trimSlashes(`${base}/${subFolder}`);
}

/**
 * Normalize client-provided file identifier (URL/path/name) to a RELATIVE key
 * (i.e., something that can be appended after moviesFolder).
 *
 * Accepts:
 *   - full URL ("https://site/uploads/movies/xyz.mp4")
 *   - absolute path ("/uploads/movies/xyz.mp4")
 *   - "uploads/movies/xyz.mp4"
 *   - "movies/xyz.mp4"
 *   - "xyz.mp4"
 */
function normalizeRelativeKey(input, moviesFolder) {
  let key = String(input || "").trim();

  // 1) If it looks like a URL, use the pathname
  if (/^https?:\/\//i.test(key)) {
    try {
      const u = new URL(key);
      key = u.pathname || key;
    } catch (_) {
      /* ignore */
    }
  }

  // 2) Drop leading slash, decode percent-encoding
  key = key.replace(/^\/+/, "");
  try {
    key = decodeURIComponent(key);
  } catch (_) {
    /* ignore */
  }

  // 3) Strip a leading "uploads/" if present (we will try both variants later)
  if (key.toLowerCase().startsWith("uploads/")) {
    key = key.slice("uploads/".length);
  }

  // 4) If the key already contains the movies folder, remove it so key is RELATIVE
  const mf = trimSlashes(moviesFolder || "");
  if (mf) {
    const needle = (mf + "/").toLowerCase();
    const pos = key.toLowerCase().indexOf(needle);
    if (pos >= 0) {
      key = key.slice(pos + needle.length);
    }
  }

  // 5) Return clean relative piece
  return trimSlashes(key);
}

/** Build the candidate *absolute* keys we will try to delete in S3. */
function buildCandidateKeys(relativeKey, moviesFolder) {
  const mf = trimSlashes(moviesFolder);
  const rel = trimSlashes(relativeKey);

  const k1 = `${mf}/${rel}`;              // "movies/abc.mp4" or "movies/sub/abc.mp4"
  const k2 = `uploads/${mf}/${rel}`;      // "uploads/movies/abc.mp4"
  const k3 = rel;                         // Just in case the object was stored flat

  // Also try space vs plus quirks (rare, but harmless)
  const variants = new Set([k1, k2, k3]);
  for (const k of [k1, k2, k3]) {
    if (k.includes("+")) variants.add(k.replace(/\+/g, " "));
    if (k.includes(" ")) variants.add(k.replace(/ /g, "+"));
  }
  return Array.from(variants).map(x => x.replace(/\/+/g, "/"));
}

/**
 * Call the storage adapter in a signature-agnostic way.
 * We try several common call shapes; the first non-throw is treated as success.
 */
async function tryDeleteThroughAdapter(fullKey) {
  const attempts = [
    () => storage.deleteFile(fullKey),
    () => storage.deleteFile({ filePath: fullKey }),
    () => storage.deleteFile({ key: fullKey }),
  ];

  for (const attempt of attempts) {
    try {
      const res = await attempt();
      // If the adapter returns a boolean-like or '{ success: ... }', consider it OK
      if (res === undefined || res === null) return true;
      if (typeof res === "boolean") return res;
      if (typeof res === "object" && "success" in res) return !!res.success;
      // Some S3 wrappers return a metadata object; no error => assume success
      return true;
    } catch (e) {
      // keep trying other signatures
    }
  }
  return false;
}

/**
 * PUBLIC: deleteMovieFile
 * Keeps response shape {success: boolean} so the UI continues to work.
 */
async function deleteMovieFile(fileName, subFolder) {
  const moviesFolder = getMoviesFolder(subFolder);
  const rel = normalizeRelativeKey(fileName, moviesFolder);
  const candidates = buildCandidateKeys(rel, moviesFolder);

  // Helpful logs in the pod (won't change API response)
  console.warn(
    "[files.delete] input=%s moviesFolder=%s rel=%s candidates=%j",
    fileName,
    moviesFolder,
    rel,
    candidates
  );

  for (const key of candidates) {
    const ok = await tryDeleteThroughAdapter(key);
    if (ok) {
      console.warn("[files.delete] deleted key=%s", key);
      return { success: true };
    }
  }

  console.error("[files.delete] FAILED for input=%s (tried=%j)", fileName, candidates);
  return { success: false };
}

/* ------------------------------------------------------------------ */
/* If this file also exports other functions in your original code,   */
/* leave them as-is below. Only deleteMovieFile has to change.        */
/* ------------------------------------------------------------------ */

module.exports = {
  deleteMovieFile,
  // ... keep/append your other exports here (listMovieFiles, etc.)
};
