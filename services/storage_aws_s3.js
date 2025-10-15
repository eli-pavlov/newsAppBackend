// services/storage_aws_s3.js
// S3 adapter with a small, stable API used by the app.

const AWS = require('aws-sdk');
const path = require('path');
const { envVar } = require('./env');

function cleanKey(k) {
  return String(k || '')
    .replace(/^\/+/, '')        // no leading "/"
    .replace(/\/{2,}/g, '/');   // collapse double slashes
}

function joinKey(prefix, part) {
  const p = String(prefix || '').replace(/\/+$/,'');
  const q = String(part || '').replace(/^\/+/,'');
  return cleanKey(`${p}/${q}`);
}

module.exports = class S3Storage {
  constructor() {
    const region = envVar('AWS_REGION');
    const accessKeyId = envVar('AWS_ACCESS_KEY_ID');
    const secretAccessKey = envVar('AWS_SECRET_ACCESS_KEY');
    const bucket = envVar('AWS_BUCKET');

    if (!bucket) {
      throw new Error('AWS_BUCKET is not set');
    }

    AWS.config.update({
      region,
      credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined
    });

    this.s3 = new AWS.S3({ signatureVersion: 'v4' });
    this.bucket = bucket;
    this.publicBase = envVar('AWS_PUBLIC_BASE_URL'); // optional CDN/base like https://cdn.example.com
  }

  // Create a logical "folder": we just write a .keep object under that prefix
  async createFolder({ folderPath }) {
    const prefix = cleanKey(String(folderPath || ''));
    const key = prefix.endsWith('/') ? `${prefix}.keep` : `${prefix}/.keep`;
    await this.s3.putObject({
      Bucket: this.bucket,
      Key: key,
      Body: '',
      ContentType: 'application/octet-stream'
    }).promise();
    return { success: true, key };
  }

  async getFolderContent({ folderPath }) {
    const prefix = cleanKey(String(folderPath || ''));
    const normalized = prefix.endsWith('/') ? prefix : `${prefix}/`;

    let ContinuationToken = undefined;
    const files = [];

    try {
      do {
        const res = await this.s3.listObjectsV2({
          Bucket: this.bucket,
          Prefix: normalized,
          ContinuationToken
        }).promise();

        (res.Contents || []).forEach(obj => {
          const k = String(obj.Key || '');
          // Skip placeholder files
          if (k.endsWith('/.keep')) return;
          // Return full keys relative to bucket root (what movies.js expects)
          files.push(k);
        });

        ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
      } while (ContinuationToken);

      return { success: true, files };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Upload a file.
   * Accepts one of: body, buffer, stream. (mimetype optional)
   */
  async uploadFile({ folderPath, fileName, body, buffer, stream, mimetype }) {
    const content =
      body ?? buffer ?? stream ?? null;

    if (!content) {
      throw new Error('No file content provided');
    }

    const key = joinKey(folderPath, fileName);

    await this.s3.putObject({
      Bucket: this.bucket,
      Key: key,
      Body: content,
      ContentType: mimetype || 'application/octet-stream',
      ACL: 'public-read' // adjust if you don’t want public
    }).promise();

    return { success: true, key };
  }

  /**
   * Delete a file by absolute bucket key path.
   */
  async deleteFile({ filePath }) {
    const key = cleanKey(filePath);

    if (process.env.DEBUG_DELETE === '1') {
      console.log('[s3.delete] incoming=', filePath, '→', key);
    }

    await this.s3.deleteObject({
      Bucket: this.bucket,
      Key: key
    }).promise();

    if (process.env.DEBUG_DELETE === '1') {
      console.log('[s3.delete] verified deleted:', key);
    }

    return { success: true, key };
  }

  /**
   * Build a public URL for a given key (or key relative to folder).
   */
  movieFilePublicUrl(key) {
    const clean = cleanKey(key);
    if (this.publicBase) {
      // Respect explicit CDN/base
      return `${this.publicBase.replace(/\/+$/,'')}/${encodeURIComponent(clean).replace(/%2F/g, '/')}`;
    }
    // Default S3 public URL
    const region = envVar('AWS_REGION');
    if (region && !region.startsWith('cn-')) {
      return `https://${this.bucket}.s3.${region}.amazonaws.com/${encodeURIComponent(clean).replace(/%2F/g,'/')}`;
    }
    // Generic fallback
    return `https://${this.bucket}.s3.amazonaws.com/${encodeURIComponent(clean).replace(/%2F/g,'/')}`;
  }
};
