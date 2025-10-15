// services/storage_aws_s3.js
//
// AWS S3 adapter used by services/storage.js.
// Exports a CLASS (constructor required by services/storage.js).

const AWS = require('aws-sdk');
const { envVar } = require('./env');

class AwsS3Storage {
  constructor() {
    this.bucket = envVar('AWS_BUCKET');
    this.region = envVar('AWS_REGION');
    this.moviesFolder = String(envVar('MOVIES_FOLDER') || 'movies').replace(/^\/+|\/+$/g, '');
    this.s3 = new AWS.S3({ region: this.region });
  }

  /** Normalize any URL/path/name into an S3 key under moviesFolder. */
  ensureKey(input, { isFolder = false } = {}) {
    let key = String(input || '').trim();

    // If given a full URL, keep only the path
    if (/^https?:\/\//i.test(key)) {
      try {
        const u = new URL(key);
        key = u.pathname || key;
      } catch (_) {}
    }

    // Strip leading slash, decode, and convert '+' to space
    key = key.replace(/^\/+/, '');
    try { key = decodeURIComponent(key); } catch (_) {}
    key = key.replace(/\+/g, ' ');

    // Drop leading "uploads/" if present
    if (key.toLowerCase().startsWith('uploads/')) {
      key = key.slice('uploads/'.length);
    }

    // Ensure prefix "moviesFolder/"
    const prefix = this.moviesFolder ? `${this.moviesFolder}/` : '';
    if (prefix && !key.toLowerCase().startsWith(prefix.toLowerCase())) {
      key = prefix + key;
    }

    // Clean up // and enforce trailing slash for folders
    key = key.replace(/\/{2,}/g, '/');
    if (isFolder && !key.endsWith('/')) key += '/';
    return key;
  }

  async getFolderContent({ folderPath }) {
    const Prefix = this.ensureKey(folderPath, { isFolder: true });

    const out = await this.s3.listObjectsV2({
      Bucket: this.bucket,
      Prefix,
    }).promise();

    const files = (out.Contents || [])
      .map(o => o.Key)
      .filter(k => k && k !== Prefix);

    return { success: true, files };
  }

  async createFolder({ folderPath }) {
    const Key = this.ensureKey(folderPath, { isFolder: true });
    await this.s3.putObject({ Bucket: this.bucket, Key, Body: '' }).promise();
    return { success: true, key: Key };
  }

  movieFilePublicUrl(s3KeyOrPath /*, subFolder */) {
    const key = this.ensureKey(s3KeyOrPath);
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${encodeURI(key)}`;
  }

  /** Delete, then verify with HeadObject (S3 delete is idempotent). */
  async deleteFile({ filePath }) {
    const Key = this.ensureKey(filePath);

    if (process.env.DEBUG_DELETE === '1') {
      console.log('[s3.delete] incoming=', filePath, '→', Key);
    }

    await this.s3.deleteObject({ Bucket: this.bucket, Key }).promise();

    // Verify: if headObject 404s, it's gone.
    try {
      await this.s3.headObject({ Bucket: this.bucket, Key }).promise();
      if (process.env.DEBUG_DELETE === '1') console.log('[s3.delete] still exists:', Key);
      return { success: false, key: Key };
    } catch (err) {
      const code = err && (err.code || err.name);
      const status = err && (err.statusCode || err.$metadata?.httpStatusCode);
      if (code === 'NotFound' || code === 'NoSuchKey' || status === 404) {
        if (process.env.DEBUG_DELETE === '1') console.log('[s3.delete] verified deleted:', Key);
        return { success: true, key: Key };
      }
      if (process.env.DEBUG_DELETE === '1') {
        console.log('[s3.delete] head error:', code || status, err?.message);
      }
      throw err;
    }
  }
}

module.exports = AwsS3Storage;
