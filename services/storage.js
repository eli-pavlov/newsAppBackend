// services/storage.js
const { envVar } = require('./env');

function pickDriver() {
  // Accept several names; default to s3 if bucket vars exist
  const explicit = (envVar('FILE_STORAGE') || envVar('STORAGE_DRIVER') || envVar('STORAGE_TYPE') || '').toLowerCase();
  if (explicit) return explicit;

  const hasS3 = !!(envVar('AWS_BUCKET') || envVar('AWS_S3_BUCKET'));
  return hasS3 ? 'aws_s3' : 'disk';
}

const driver = pickDriver();

let Adapter;
if (driver === 'aws_s3' || driver === 's3') {
  Adapter = require('./storage_aws_s3');
} else {
  Adapter = require('./storage_disk');
}

const storage = new Adapter();
module.exports = storage;
