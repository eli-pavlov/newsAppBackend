// newsAppBackend/controllers/files.js
const s3Service = require('../services/s3Service');
const { getUserId } = require('../services/user');
const { db } = require('../services/db');

class filesController {
    constructor() {}

    /**
     * Generates a pre-signed URL and an object key for the client to upload a file.
     */
    async generatePresignedUrl(req, res) {
        try {
            const { fileName, contentType } = req.body;
            const subFolder = getUserId(req.user);

            if (!fileName || !contentType) {
                return res.status(400).json({ success: false, message: 'fileName and contentType are required.' });
            }

            const result = await s3Service.generateUploadUrl(fileName, contentType, subFolder);
            
            if (result.success) {
                res.status(200).json(result);
            } else {
                res.status(500).json(result);
            }
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    }

    /**
     * Finalizes the upload process. It verifies the file exists on S3
     * and then saves its metadata to the database.
     */
    async finalizeUpload(req, res) {
        try {
            const { objectKey, fileName, contentType } = req.body;
            const userId = getUserId(req.user);

            if (!objectKey || !fileName || !contentType) {
                return res.status(400).json({ success: false, message: 'objectKey, fileName, and contentType are required.' });
            }

            // 1. Verify the file was actually uploaded to S3
            const verification = await s3Service.verifyFileExists(objectKey);
            if (!verification.success) {
                return res.status(404).json(verification);
            }

            // 2. If verification passes, create the permanent URL and DB record
            const url = s3Service.getFileUrl(objectKey);
            const fileData = {
                user_id: userId,
                file_name: fileName,
                object_key: objectKey,
                url: url,
                content_type: contentType,
                deletable: true, // Assuming user-uploaded files are deletable
                times: 1,
                active: true
            };
            
            const dbResult = await db.addFile(fileData);

            if (dbResult.success) {
                res.status(201).json({ success: true, data: dbResult.data });
            } else {
                // Optional: If DB write fails, consider deleting the orphaned S3 object
                // await s3Service.deleteFile(objectKey);
                res.status(500).json(dbResult);
            }
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    }

    /**
     * Deletes a file from S3 and its corresponding record from the database.
     */
    async delete(req, res) {
        const { objectKey } = req.body;
        const userId = getUserId(req.user);

        if (!objectKey) {
            return res.status(400).json({ success: false, message: 'objectKey is required.' });
        }
        
        try {
            // 1. Delete from S3
            const s3Result = await s3Service.deleteFile(objectKey);
            if (!s3Result.success) {
                // Still attempt to delete from DB even if S3 fails, to clean up records.
                // Depending on the desired behavior, you might want to stop here.
                console.warn(`S3 deletion failed for ${objectKey}, attempting DB deletion.`);
            }

            // 2. Delete from Database
            const dbResult = await db.deleteFileByObjectKey(objectKey, userId);
            
            if (dbResult.success) {
                res.status(200).json({ success: true, message: "File deleted successfully." });
            } else {
                res.status(500).json(dbResult);
            }
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    }
}
module.exports = new filesController();