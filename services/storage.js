const { envVar } = require('./env');
const storage_disk = require('./storage_disk');
const storage_aws_s3 = require('./storage_aws_s3');

const storageType = envVar('STORAGE_TYPE');
let storage;

if (storageType === 'DISK') {
    // Assign the already-created instance directly
    storage = storage_disk;
} else if (storageType === 'AWS_S3') {
    // Assign the already-created instance directly
    storage = storage_aws_s3;
} else {
    // Default to disk if not specified
    console.warn('STORAGE_TYPE not set, defaulting to DISK.');
    storage = storage_disk;
}

// Export the selected instance
module.exports = storage;