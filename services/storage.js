// services/storage.js
const { envVar } = require('./env');

let StorageClass;
const type = String(envVar('STORAGE_TYPE') || '').toUpperCase();

if (type === 'AWS_S3' || type === 'S3') {
  StorageClass = require('./storage_aws_s3');
} else {
  StorageClass = require('./storage_disk');
}

const storage = new StorageClass();

module.exports = storage;
