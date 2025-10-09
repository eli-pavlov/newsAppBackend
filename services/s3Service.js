// newsAppBackend/services/s3Service.js
const { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { envVar } = require('./env');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const s3Client = new S3Client({
    region: envVar('AWS_REGION'),
    credentials: {
        accessKeyId: envVar('AWS_ACCESS_KEY_ID'),
        awsSecretAccessKey: envVar('AWS_SECRET_ACCESS_KEY'),
    },
});

const BUCKET_NAME = envVar('AWS_BUCKET');
const MOVIES_FOLDER = envVar('MOVIES_FOLDER') || 'movies';

class S3Service {
    /**
     * Generates a pre-signed URL for uploading a file to a user-specific folder in S3.
     */
    async generateUploadUrl(fileName, contentType, subFolder) {
        try {
            const fileExtension = path.extname(fileName);
            const uniqueFileName = `${uuidv4()}${fileExtension}`;
            const objectKey = `${MOVIES_FOLDER}/${subFolder}/${uniqueFileName}`;

            const command = new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: objectKey,
                ContentType: contentType,
            });

            const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // URL expires in 1 hour
            
            return { success: true, uploadUrl, objectKey };
        } catch (error) {
            console.error("Error generating pre-signed URL:", error);
            return { success: false, message: "Could not generate upload URL." };
        }
    }

    /**
     * Verifies if an object exists in the S3 bucket.
     */
    async verifyFileExists(objectKey) {
        try {
            const command = new HeadObjectCommand({
                Bucket: BUCKET_NAME,
                Key: objectKey,
            });
            await s3Client.send(command);
            return { success: true };
        } catch (error) {
            if (error.name === 'NotFound') {
                return { success: false, message: 'File not found after upload.' };
            }
            console.error("Error verifying file existence:", error);
            return { success: false, message: 'Could not verify file.' };
        }
    }

    /**
     * Deletes a file from the S3 bucket.
     */
    async deleteFile(objectKey) {
        try {
            const command = new DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: objectKey,
            });
            await s3Client.send(command);
            return { success: true };
        } catch (error) {
            console.error("Error deleting file from S3:", error);
            return { success: false, message: 'Could not delete file from storage.' };
        }
    }

    /**
     * Constructs the permanent public URL for an S3 object.
     */
    getFileUrl(objectKey) {
        return `https://${BUCKET_NAME}.s3.${envVar('AWS_REGION')}.amazonaws.com/${objectKey}`;
    }
}

module.exports = new S3Service();