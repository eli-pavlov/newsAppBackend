// services/storage.js
const config = require('config'); // If using node-config for this
// Or directly from process.env if not using config

let storageType = process.env.STORAGE_TYPE || config.get('storage.type'); // Pull from env or config
if (!storageType) {
    storageType = 'aws_s3'; // Or 'base' – choose a default
}

let storage_class;
if (storageType === 'disk') {
    storage_class = require('./storage_disk');
} else if (storageType === 'aws_s3') {
    storage_class = require('./storage_aws_s3');
} else {
    storage_class = require('./storage_base'); // Fallback if invalid type
}

const storage = new storage_class();
module.exports = storage;