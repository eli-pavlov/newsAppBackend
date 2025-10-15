// services/storage_aws_s3.js
const AWS = require('aws-sdk');
const { envVar } = require('./env');

class AwsS3Storage {
  constructor() {
    this.bucket = envVar('AWS_BUCKET');
    this.region = envVar('AWS_REGION');
    this.moviesFolder = String(envVar('MOVIES_FOLDER') || 'movies').replace(/^\/+|\/+$/g, '');
    this.s3 = new AWS.S3({ region: this.region });
  }

  // Normalize any URL/path/name into an S3 key under moviesFolder.
  ensureKey(input, { isFolder = false } = {}) {
    let key = String(input || '').trim();

    if (/^https?:\/\//i.test(key)) {
      try { key = new URL(key).pathname || key; } catch (_) {}
    }
    key = key.replace(/^\/+/, '');
    try { key = decodeURIComponent(key); } catch (_) {}
    key = key.replace(/\+/g, ' ');
    if (key.toLowerCase().startsWith('uploads/')) key = key.slice('uploads/'.length);

    const prefix = this.moviesFolder ? `${this.moviesFolder}/` : '';
    if (prefix && !key.toLowerCase().startsWith(prefix.toLowerCase())) key = prefix + key;

    key = key.replace(/\/{2,}/g, '/');
    if (isFolder && !key.endsWith('/')) key += '/';
    return key;
  }

  async getFolderContent({ folderPath }) {
    const Prefix = this.ensureKey(folderPath, { isFolder: true });

    // Delimiter confines listing to the "current directory" only.
    const out = await this.s3.listObjectsV2({
      Bucket: this.bucket,
      Prefix,
      Delimiter: '/'
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

  async deleteFile({ filePath }) {
    const Key = this.ensureKey(filePath);
    if (process.env.DEBUG_DELETE === '1') {
      console.log('[s3.delete] incoming=', filePath, '→', Key);
    }

    await this.s3.deleteObject({ Bucket: this.bucket, Key }).promise();

    // Verify with headObject (delete is idempotent; this tells us if it still exists)
    try {
      await this.s3.headObject({ Bucket: this.bucket, Key }).promise();
      if (process.env.DEBUG_DELETE === '1') console.log('[s3.delete] still exists:', Key);
      return { success: false, key: Key };
    } catch (err) {
      const code = err.code || err.name;
      const status = err.statusCode || err.$metadata?.httpStatusCode;
      if (code === 'NotFound' || code === 'NoSuchKey' || status === 404) {
        if (process.env.DEBUG_DELETE === '1') console.log('[s3.delete] verified deleted:', Key);
        return { success: true, key: Key };
      }
      if (process.env.DEBUG_DELETE === '1') console.log('[s3.delete] head error:', code || status, err?.message);
      throw err;
    }
  }
}

module.exports = AwsS3Storage;
