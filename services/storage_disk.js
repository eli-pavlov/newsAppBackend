// services/storage_disk.js
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { envVar } = require('./env');

class DiskStorage {
  constructor() {
    // Root directory for files, default to ./uploads
    this.root = path.resolve(envVar('FILES_ROOT') || 'uploads');
    this.moviesFolder = String(envVar('MOVIES_FOLDER') || 'movies').replace(/^\/+|\/+$/g, '');
  }

  ensureAbsPath(input, { isFolder = false } = {}) {
    let p = String(input || '').trim().replace(/\\/g, '/');
    if (/^https?:\/\//i.test(p)) {
      try { p = new URL(p).pathname || p; } catch (_) {}
    }
    p = p.replace(/^\/+/, '');
    try { p = decodeURIComponent(p); } catch (_) {}
    p = p.replace(/\+/g, ' ');
    if (p.toLowerCase().startsWith('uploads/')) p = p.slice('uploads/'.length);

    const prefix = this.moviesFolder ? `${this.moviesFolder}/` : '';
    if (prefix && !p.toLowerCase().startsWith(prefix.toLowerCase())) p = prefix + p;
    p = p.replace(/\/{2,}/g, '/');
    if (isFolder && !p.endsWith('/')) p += '/';

    return path.join(this.root, p);
  }

  async getFolderContent({ folderPath }) {
    const dir = this.ensureAbsPath(folderPath, { isFolder: true });
    try {
      const entries = await fsp.readdir(dir, { withFileTypes: true });
      const files = entries.filter(e => e.isFile()).map(e => e.name).map(name =>
        path.posix.join(
          String(this.moviesFolder),
          String(folderPath || '').replace(/^\/+|\/+$/g, ''),
          name
        ).replace(/\/{2,}/g, '/')
      );
      return { success: true, files };
    } catch (_) {
      return { success: true, files: [] };
    }
  }

  async createFolder({ folderPath }) {
    const dir = this.ensureAbsPath(folderPath, { isFolder: true });
    await fsp.mkdir(dir, { recursive: true });
    return { success: true };
  }

  movieFilePublicUrl(filePath /*, subFolder */) {
    // For dev: return a pseudo URL or a relative path under /uploads
    const rel = String(filePath).replace(/\\+/g, '/').replace(/^\/+/, '');
    return '/' + rel;
  }

  async deleteFile({ filePath }) {
    const abs = this.ensureAbsPath(filePath);
    try {
      await fsp.unlink(abs);
      return { success: true, key: filePath };
    } catch (_) {
      // If it already doesn't exist, consider it deleted
      return { success: false, key: filePath };
    }
  }

  async uploadFile(args = {}) {
    let { folderPath, filePath, fileName, body, buffer, stream, file } = args;

    if (file && !body && !buffer && !stream) {
      if (file.buffer) buffer = file.buffer;
      else if (file.data) buffer = file.data;
      else if (file.path || file.tempFilePath) {
        stream = fs.createReadStream(file.path || file.tempFilePath);
      }
      if (!fileName) fileName = file.originalname || file.name;
    }

    if (!body && buffer) body = buffer;
    if (!body && !stream) throw new Error('uploadFile: no body/buffer/stream provided');
    if (!fileName && !filePath) throw new Error('uploadFile: fileName or filePath required');

    let abs;
    if (filePath) {
      abs = this.ensureAbsPath(filePath);
    } else {
      const base = folderPath ? String(folderPath) : `${this.moviesFolder}/`;
      const joined = path.posix.join(base.replace(/\/+$/, ''), String(fileName));
      abs = this.ensureAbsPath(joined);
    }

    await fsp.mkdir(path.dirname(abs), { recursive: true });

    if (stream) {
      await new Promise((resolve, reject) => {
        const w = fs.createWriteStream(abs);
        stream.pipe(w).on('finish', resolve).on('error', reject);
      });
    } else {
      await fsp.writeFile(abs, body);
    }

    // Return key relative to movies folder (S3-style path)
    const key = abs
      .replace(this.root + path.sep, '')
      .replace(/\\/g, '/');

    return { success: true, key, url: this.movieFilePublicUrl(key) };
    }
}

module.exports = DiskStorage;
