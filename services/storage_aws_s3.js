// backend/services/storage_aws_s3.js (added ContentType to presignPut for MIME; minor tweaks)
const AWS = require('aws-sdk');
const { envVar } = require('./env');

const s3 = new AWS.S3({
    accessKeyId: envVar('AWS_ACCESS_KEY_ID'),
    secretAccessKey: envVar('AWS_SECRET_ACCESS_KEY'),
    region: envVar('AWS_REGION')
});

const bucket = envVar('AWS_BUCKET');

async function uploadFile(req, res) {
    // Legacy upload, now unused
    return { success: false, message: 'Direct upload deprecated; use presigned URLs' };
}

async function getMoviesList(userId) {
    const params = {
        Bucket: bucket,
        Prefix: `movies/${userId}/`
    };
    const data = await s3.listObjectsV2(params).promise();
    return data.Contents ? data.Contents
        .filter(obj => obj.Key.endsWith('.mp4')) // Filter for videos only
        .map(obj => ({
            name: obj.Key.split('/').pop(),
            url: `https://${bucket}.s3.${envVar('AWS_REGION')}.amazonaws.com/${obj.Key}`,
            subFolder: userId,
            deletable: true
        })) : [];
}

async function presignPut(fileName, subFolder, contentType = 'video/mp4') {
    const key = `movies/${subFolder}/${fileName}`;
    const url = s3.getSignedUrl('putObject', {
        Bucket: bucket,
        Key: key,
        Expires: 3600, // 1 hour
        ContentType: contentType
    });
    return { success: true, url };
}

async function presignDelete(fileName, subFolder) {
    const key = `movies/${subFolder}/${fileName}`;
    const url = s3.getSignedUrl('deleteObject', {
        Bucket: bucket,
        Key: key,
        Expires: 3600 // 1 hour
    });
    return { success: true, url };
}

module.exports = {
    uploadFile,
    getMoviesList,
    presignPut,
    presignDelete
};