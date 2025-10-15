// services/storage_disk.js
// Local disk adapter (kept for parity; prod uses S3).

const fs = require('fs/promises');
const path = require('path');
const { envVar } = require('./env');

function ensureTrailingSlash(p) {
  return p.endsWith(path.sep) ? p : p + path.sep;
}

function isSubPath(parent, candidate) {
  const rel = path.relative(parent, candidate);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

module.exports = class DiskStorage {
  constructor() {
    const root = envVar('DISK_ROOT_PATH') || '/data';
    this.root = path.resolve(root);
  }

  async createFolder({ folderPath }) {
    const p = path.resolve(this.root, folderPath || '');
    if (!isSubPath(this.root, p) && p !== this.root) throw new Error('Invalid folderPath');
    await fs.mkdir(p, { recursive: true });
    return { success: true, path: p };
  }

  async getFolderContent({ folderPath }) {
    const base = path.resolve(this.root, folderPath || '');
    if (!isSubPath(this.root, base) && base !== this.root) throw new Error('Invalid folderPath');

    try {
      const out = [];
      const rootWithSlash = ensureTrailingSlash(base);

      async function walk(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const e of entries) {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) {
            await walk(full);
          } else {
            out.push(full);
          }
        }
      }

      await walk(base);

      // Return keys relative to disk root (mimic S3-style keys)
      const keys = out.map(f => {
        const rel = path.relative(base, f).split(path.sep).join('/');
        const prefix = (folderPath || '').replace(/^\/+|\/+$/g, '');
        return prefix ? `${prefix}/${rel}` : rel;
      });

      return { success: true, files: keys };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  async uploadFile({ folderPath, fileName, body, buffer, stream /*, mimetype*/ }) {
    const content = body ?? buffer ?? null;
    if (!content) throw new Error('No file content provided');

    const dir = path.resolve(this.root, folderPath || '');
    if (!isSubPath(this.root, dir) && dir !== this.root) throw new Error('Invalid folderPath');

    await fs.mkdir(dir, { recursive: true });
    const full = path.join(dir, fileName);
    await fs.writeFile(full, content);
    return { success: true, path: full };
  }

  async deleteFile({ filePath }) {
    const full = path.resolve(this.root, filePath || '');
    if (!isSubPath(this.root, full) && full !== this.root) throw new Error('Invalid filePath');
    await fs.rm(full, { force: true });
    return { success: true };
  }

  // For disk we can only return a relative path; the frontend typically uses the API
  movieFilePublicUrl(key) {
    return `/public/${String(key).replace(/^\/+/, '')}`;
  }
};
