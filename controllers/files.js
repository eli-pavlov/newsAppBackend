const AWS = require('aws-sdk');
const { envVar } = require('../services/env');
const { deleteMovieFile } = require('../services/movies');
const storage = require('../services/storage');

class filesController {
    constructor() {
        // lazy init S3 to avoid affecting DISK mode
        this._s3 = null;
    }

    s3() {
        if (!this._s3) {
            this._s3 = new AWS.S3({
                accessKeyId: envVar('AWS_ACCESS_KEY_ID'),
                secretAccessKey: envVar('AWS_SECRET_ACCESS_KEY'),
                region: envVar('AWS_REGION')
            });
        }
        return this._s3;
    }

    // Legacy upload endpoint (still used in DISK mode). In AWS_S3 mode prefer /files/presign + direct browser upload.
    async upload(req, res) {
        try {
            const result = await storage.uploadFile(req, res);
            if (result && result.success) {
                res.status(200).json(result);
            } else {
                res.status(500).json(result || { success:false, message:'Upload failed' });
            }
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    }

    async delete(req, res) {
        try {
            const { fileName, subFolder=null } = req.body || {};
            const result = await deleteMovieFile(fileName, subFolder);
            if (result && result.success) {
                res.status(200).json(result);
            } else {
                res.status(500).json(result || { success:false, message:'Delete failed' });
            }
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    }

    // NEW: request a pre-signed URL for direct S3 upload
    async presign(req, res) {
        try {
            const storageType = envVar('STORAGE_TYPE');
            if (storageType !== 'AWS_S3') {
                return res.status(400).json({ success: false, message: 'Presign is only available when STORAGE_TYPE=AWS_S3' });
            }

            const { fileName, contentType='application/octet-stream', subFolder=null } = req.body || {};
            if (!fileName) {
                return res.status(400).json({ success: false, message: 'fileName is required' });
            }

            const bucket = envVar('AWS_BUCKET');
            const region = envVar('AWS_REGION');
            const moviesFolder = envVar('MOVIES_FOLDER') || 'movies';
            const key = `${moviesFolder}/${subFolder ? subFolder + '/' : ''}${fileName}`;

            const url = this.s3().getSignedUrl('putObject', {
                Bucket: bucket,
                Key: key,
                ContentType: contentType,
                Expires: 900, // 15 minutes
            });

            const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

            res.status(200).json({
                success: true,
                url,
                method: 'PUT',
                headers: { 'Content-Type': contentType },
                objectKey: key,
                publicUrl
            });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    }

    // OPTIONAL: verify object exists and respond with standard shape
    async finalize(req, res) {
        try {
            const storageType = envVar('STORAGE_TYPE');
            if (storageType !== 'AWS_S3') {
                return res.status(400).json({ success: false, message: 'Finalize is only available when STORAGE_TYPE=AWS_S3' });
            }

            const { objectKey, fileName, subFolder=null } = req.body || {};
            if (!objectKey) {
                return res.status(400).json({ success: false, message: 'objectKey is required' });
            }

            const bucket = envVar('AWS_BUCKET');
            const region = envVar('AWS_REGION');

            // HEAD the object; if missing, AWS throws
            await this.s3().headObject({ Bucket: bucket, Key: objectKey }).promise();

            const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${objectKey}`;

            return res.status(200).json({
                success: true,
                url: publicUrl,
                file_name: fileName || (objectKey.split('/').pop()),
                subFolder
            });
        } catch (e) {
            const msg = (e && e.code === 'NotFound') ? 'Object not found in S3 (upload may have failed)' : e.message;
            res.status(500).json({ success: false, message: msg });
        }
    }
}

module.exports = new filesController();
