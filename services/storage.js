// services/storage.js
const config = require('config'); // or use process.env only if you prefer

// Normalize STORAGE_TYPE casing/hyphenation so we accept: AWS_S3, aws_s3, Aws-S3, s3, aws, disk, DISK, etc.
let storageType =
  (process.env.STORAGE_TYPE ??
    (config && config.has && config.has('storage.type') ? config.get('storage.type') : ''));

storageType = String(storageType || '')
  .trim()
  .toLowerCase()
  .replace(/-/g, '_');

let storage_class;
if (storageType === 'disk') {
  storage_class = require('./storage_disk');
} else if (storageType === 'aws_s3' || storageType === 'aws' || storageType === 's3') {
  storage_class = require('./storage_aws_s3');
} else {
  // Fallback (keeps server up even if env is missing)
  storage_class = require('./storage_base');
}

const storage = new storage_class();
module.exports = storage;
