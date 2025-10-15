// services/storage_aws_s3.js
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const { envVar } = require('./env');

class AwsS3Storage {
  constructor() {
    this.bucket = envVar('AWS_BUCKET') || envVar('AWS_S3_BUCKET');
    this.region = envVar('AWS_REGION') || 'us-east-1';
    this.moviesFolder = String(envVar('MOVIES_FOLDER') || 'movies').replace(/^\/+|\/+$/g, '');
    this.s3 = new AWS.S3({ region: this.region });
  }

  // ---- key/path helpers ----
  ensureKey(input, { isFolder = false } = {}) {
    let key = String(input || '').trim();

    // accept full URL
    if (/^https?:\/\//i.test(key)) {
      try { key = new URL(key).pathname || key; } catch (_) {}
    }
    key = key.replace(/^\/+/, '');
    try { key = decodeURIComponent(key); } catch (_) {}
    key = key.replace(/\+/g, ' ');

    // strip leading uploads/
    if (key.toLowerCase().startsWith('uploads/')) key = key.slice('uploads/'.length);

    // ensure movies/ prefix
    const prefix = this.moviesFolder ? `${this.moviesFolder}/` : '';
    if (prefix && !key.toLowerCase().startsWith(prefix.toLowerCase())) key = prefix + key;

    key = key.replace(/\/{2,}/g, '/');
    if (isFolder && !key.endsWith('/')) key += '/';
    return key;
  }

  // ---- listing ----
  async getFolderContent({ folderPath }) {
    const Prefix = this.ensureKey(folderPath, { isFolder: true });
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

  // ---- create folder ----
  async createFolder({ folderPath }) {
    const Key = this.ensureKey(folderPath, { isFolder: true });
    await this.s3.putObject({ Bucket: this.bucket, Key, Body: '' }).promise();
    return { success: true, key: Key };
  }

  // ---- public URL ----
  movieFilePublicUrl(s3KeyOrPath /*, subFolder */) {
    const key = this.ensureKey(s3KeyOrPath);
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${encodeURI(key)}`;
  }

  // ---- delete ----
  async deleteFile({ filePath }) {
    const Key = this.ensureKey(filePath);
    if (process.env.DEBUG_DELETE === '1') {
      console.log('[s3.delete] incoming=', filePath, '→', Key);
    }

    await this.s3.deleteObject({ Bucket: this.bucket, Key }).promise();

    // verify gone
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
      throw err;
    }
  }

  // ---- upload ----
  /**
   * Flexible upload:
   *   uploadFile({ folderPath, fileName, body|buffer|stream|file, contentType, acl })
   *   uploadFile({ filePath, body|buffer|stream|file, contentType, acl })
   *
   * Supports multer (file.buffer), express-fileupload (file.data), or raw buffers/streams.
   */
  async uploadFile(args = {}) {
    let {
      folderPath,
      filePath,
      fileName,
      body,
      buffer,
      stream,
      file,
      contentType,
      acl
    } = args;

    // derive from typical upload objects
    if (file && !body && !buffer && !stream) {
      if (file.buffer) buffer = file.buffer;               // multer
      else if (file.data) buffer = file.data;              // express-fileupload
      else if (file.path || file.tempFilePath) {
        const p = file.path || file.tempFilePath;
        stream = fs.createReadStream(p);
      }
      if (!fileName) fileName = file.originalname || file.name;
      if (!contentType) contentType = file.mimetype;
    }

    if (!body && buffer) body = buffer;
    if (!body && stream) body = stream;
    if (!body) throw new Error('uploadFile: no body/buffer/stream provided');
    if (!fileName && !filePath) throw new Error('uploadFile: fileName or filePath required');

    let Key;
    if (filePath) {
      Key = this.ensureKey(filePath);
    } else {
      const base = folderPath ? String(folderPath) : `${this.moviesFolder}/`;
      const joined = path.posix.join(base.replace(/\/+$/, ''), String(fileName));
      Key = this.ensureKey(joined);
    }

    const params = {
      Bucket: this.bucket,
      Key,
      Body: body,
      ContentType: contentType || 'application/octet-stream'
    };
    if (acl) params.ACL = acl; // e.g., 'public-read'

    await this.s3.putObject(params).promise();

    return { success: true, key: Key, url: this.movieFilePublicUrl(Key) };
  }
}

module.exports = AwsS3Storage;
