// services/s3Service.js
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const { envVar } = require('./env');

const s3Client = new S3Client({
    region: envVar('AWS_REGION'),
    credentials: {
        accessKeyId: envVar('AWS_ACCESS_KEY_ID'),
        secretAccessKey: envVar('AWS_SECRET_ACCESS_KEY'),
    },
});

const BUCKET_NAME = envVar('AWS_BUCKET');
const MOVIES_FOLDER = envVar('MOVIES_FOLDER');

async function generateUploadUrl(fileName, contentType, subFolder) {
    if (!BUCKET_NAME || !MOVIES_FOLDER) {
        return { success: false, message: 'S3 bucket or movies folder not configured on the server.' };
    }

    try {
        const uniqueFileName = `${uuidv4()}-${fileName.replace(/\s+/g, '-')}`;
        const objectKey = `${MOVIES_FOLDER}/${subFolder}/${uniqueFileName}`;

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: objectKey,
            ContentType: contentType,
        });

        const preSignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
        const objectUrl = `https://${BUCKET_NAME}.s3.${envVar('AWS_REGION')}.amazonaws.com/${objectKey}`;

        return {
            success: true,
            preSignedUrl,
            file_name: fileName,
            url: objectUrl,
            subFolder: subFolder,
            deletable: true,
            times: "1",
            active: true
        };
    } catch (error) {
        console.error('Error generating pre-signed URL:', error);
        return { success: false, message: 'Could not generate upload URL.' };
    }
}

module.exports = {
    generateUploadUrl
};
