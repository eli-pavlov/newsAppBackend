// services/storage.js
const { envVar } = require('./env');

function pickDriver() {
  const explicit =
    (envVar('FILE_STORAGE') ||
     envVar('STORAGE_DRIVER') ||
     envVar('STORAGE_TYPE') ||
     '').toLowerCase();

  if (explicit) return explicit;

  // Auto-detect S3 if bucket envs are present
  if (envVar('AWS_BUCKET') || envVar('AWS_S3_BUCKET')) return 'aws_s3';

  return 'disk';
}

const driver = pickDriver();

let Adapter;
if (driver === 'aws_s3' || driver === 's3') {
  Adapter = require('./storage_aws_s3');
} else {
  Adapter = require('./storage_disk');
}

// Export a singleton instance
const storage = new Adapter();

/**
 * Backward-compat shim:
 * If for any reason the adapter doesn’t implement uploadFile,
 * add a minimal pass-through that throws a helpful error.
 */
if (typeof storage.uploadFile !== 'function') {
  storage.uploadFile = async () => {
    throw new Error(
      'uploadFile is not implemented by the active storage adapter. ' +
      'Make sure services/storage_aws_s3.js or services/storage_disk.js is updated.'
    );
  };
}

module.exports = storage;
