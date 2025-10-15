// services/storage_aws_s3.js
//
// AWS S3 adapter used by services/storage.js.
// Focus: robust key normalization and verified deletion.

const AWS = require('aws-sdk');
const { envVar } = require('./env');

const BUCKET = envVar('AWS_BUCKET');
const REGION = envVar('AWS_REGION');
const MOVIES_FOLDER = String(envVar('MOVIES_FOLDER') || 'movies').replace(/^\/+|\/+$/g, ''); // e.g. "movies"

const s3 = new AWS.S3({ region: REGION });

/** Convert any incoming "path" (URL, /uploads/..., relative name) to a bucket key:
 *  - strips leading "/" and "uploads/"
 *  - decodes %.. and turns "+" into space
 *  - ensures it is under MOVIES_FOLDER/
 *  - for folders, ensures trailing "/"
 */
function ensureKey(p, { isFolder = false } = {}) {
  let key = String(p || '').trim();

  // full URL? keep only pathname
  if (/^https?:\/\//i.test(key)) {
    try {
      const u = new URL(key);
      key = u.pathname || key;
    } catch (_) {}
  }

  key = key.replace(/^\/+/, '');
  try { key = decodeURIComponent(key); } catch (_) {}
  key = key.replace(/\+/g, ' ');

  if (key.toLowerCase().startsWith('uploads/')) {
    key = key.slice('uploads/'.length);
  }

  const prefix = MOVIES_FOLDER ? `${MOVIES_FOLDER}/` : '';
  if (prefix && !key.toLowerCase().startsWith(prefix.toLowerCase())) {
    key = prefix + key;
  }

  key = key.replace(/\/{2,}/g, '/');
  if (isFolder && !key.endsWith('/')) key += '/';
  return key;
}

/** List objects under a logical "folderPath" */
async function getFolderContent({ folderPath }) {
  const Prefix = ensureKey(folderPath, { isFolder: true });

  const out = await s3.listObjectsV2({
    Bucket: BUCKET,
    Prefix,
  }).promise();

  const files = (out.Contents || [])
    .map(o => o.Key)
    .filter(k => k && k !== Prefix);

  return { success: true, files };
}

/** Create a zero-byte "folder" marker (optional for S3 but harmless) */
async function createFolder({ folderPath }) {
  const Key = ensureKey(folderPath, { isFolder: true });
  await s3.putObject({ Bucket: BUCKET, Key, Body: '' }).promise();
  return { success: true, key: Key };
}

/** Build a public URL that the frontend can consume.
 * If your objects are private and you front them via the backend, you can instead
 * return `/uploads/${ensureKey(s3KeyOrPath)}` to keep old paths.
 */
function movieFilePublicUrl(s3KeyOrPath /*, subFolder */) {
  const key = ensureKey(s3KeyOrPath);
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${encodeURI(key)}`;
}

/** Delete and then verify with HeadObject so we only report success when the object is gone */
async function deleteFile({ filePath }) {
  const Key = ensureKey(filePath);

  if (process.env.DEBUG_DELETE === '1') {
    console.log('[s3.delete] incoming=', filePath, 'normalized Key=', Key);
  }

  await s3.deleteObject({ Bucket: BUCKET, Key }).promise();

  // Verify. S3 delete is idempotent; 204 doesn't mean it existed.
  try {
    await s3.headObject({ Bucket: BUCKET, Key }).promise();
    if (process.env.DEBUG_DELETE === '1') console.log('[s3.delete] still exists:', Key);
    return { success: false, key: Key };
  } catch (err) {
    const code = err && (err.code || err.name);
    const status = err && (err.statusCode || err.$metadata?.httpStatusCode);
    const notFound = code === 'NotFound' || code === 'NoSuchKey' || status === 404;
    if (notFound) {
      if (process.env.DEBUG_DELETE === '1') console.log('[s3.delete] verified deleted:', Key);
      return { success: true, key: Key };
    }
    // unexpected error (permissions, transient network, etc.)
    if (process.env.DEBUG_DELETE === '1') console.log('[s3.delete] head error:', code || status, err?.message);
    throw err;
  }
}

module.exports = {
  getFolderContent,
  createFolder,
  movieFilePublicUrl,
  deleteFile,
};
