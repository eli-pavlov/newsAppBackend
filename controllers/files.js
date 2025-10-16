// Backend — controllers/files.js
//
// Files Controller
// Implements handlers for file routes: legacy upload/delete and new S3 presign/finalize.
// Uses tolerant input parsing from body, query, or headers.
// Ensures compatibility with different storage types (S3 or disk).
//
// Helpers:
// - firstNonEmpty: Selects first valid value.
// - decodeMaybe: Decodes URL-encoded strings safely.
// - parseUploadRequest: Extracts params for presign.
// - parseFinalizeRequest: Extracts params for finalize.

const AWS = require('aws-sdk');                        // AWS SDK for S3.
const { envVar } = require('../services/env');         // Environment variable access.
const { deleteMovieFile } = require('../services/movies'); // Delete logic from movies service.
const storage = require('../services/storage');        // Legacy storage handler.

/**
 * firstNonEmpty: Returns the first non-empty value from arguments.
 */
function firstNonEmpty(...vals) {
    for (const v of vals) {
        if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return undefined;
}

/**
 * decodeMaybe: Decodes URI components if possible.
 */
function decodeMaybe(v) {
    if (typeof v !== 'string') return v;
    try { return decodeURIComponent(v); } catch { return v; }
}

/**
 * parseUploadRequest: Parses fileName, subFolder, contentType from request.
 * Sources: body, query, headers. Applies defaults.
 */
function parseUploadRequest(req) {
    const body = (req && req.body) ? req.body : {};
    const query = (req && req.query) ? req.query : {};
    const hdr = (req && req.headers) ? req.headers : {};

    let fileName = firstNonEmpty(body.fileName, body.filename, body.name, query.fileName, query.filename, query.name, hdr['x-file-name'], hdr['x-filename']);
    fileName = decodeMaybe(fileName);

    let subFolderRaw = firstNonEmpty(body.subFolder, query.subFolder, hdr['x-sub-folder']);
    subFolderRaw = decodeMaybe(subFolderRaw);
    const subFolder = (subFolderRaw === 'null' || subFolderRaw === 'undefined') ? null : subFolderRaw;

    const explicitCT = firstNonEmpty(body.contentType, body.mimeType, query.contentType, query.mimeType, hdr['x-content-type']);
    let contentType = decodeMaybe(explicitCT || '');
    if (!contentType) {
        const hct = hdr['content-type'];
        if (hct && !/^multipart\/form-data/i.test(hct)) contentType = hct.split(';')[0];
    }
    if (!contentType) contentType = 'application/octet-stream';

    return { fileName, subFolder, contentType };
}

/**
 * parseFinalizeRequest: Parses objectKey, fileName, subFolder for finalize.
 */
function parseFinalizeRequest(req) {
    const body = (req && req.body) ? req.body : {};
    const query = (req && req.query) ? req.query : {};
    const hdr = (req && req.headers) ? req.headers : {};

    let objectKey = firstNonEmpty(body.objectKey, query.objectKey, hdr['x-object-key']);
    objectKey = decodeMaybe(objectKey);

    let fileName = firstNonEmpty(body.fileName, body.filename, body.name, query.fileName, query.filename, query.name, hdr['x-file-name'], hdr['x-filename']);
    fileName = decodeMaybe(fileName);

    let subFolderRaw = firstNonEmpty(body.subFolder, query.subFolder, hdr['x-sub-folder']);
    subFolderRaw = decodeMaybe(subFolderRaw);
    const subFolder = (subFolderRaw === 'null' || subFolderRaw === 'undefined') ? null : subFolderRaw;

    return { objectKey, fileName, subFolder };
}

// Controller class with S3 client and bound handlers.
class filesController {
    constructor() {
        this._s3 = null; // Lazy-initialized S3 client.

        // Bind methods to preserve 'this' in Express.
        this.upload   = this.upload.bind(this);
        this.delete   = this.delete.bind(this);
        this.presign  = this.presign.bind(this);
        this.finalize = this.finalize.bind(this);
    }

    // Lazy load S3 client using environment credentials.
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

    // Legacy upload: Server processes the file upload.
    async upload(req, res) {
        try {
            const result = await storage.uploadFile(req, res);
            if (result && result.success) res.status(200).json(result);
            else res.status(500).json(result || { success:false, message:'Upload failed' });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    }

    // Delete file using movie service.
    async delete(req, res) {
        try {
            const { fileName, subFolder=null } = req.body || {};
            const result = await deleteMovieFile(fileName, subFolder);
            if (result && result.success) res.status(200).json(result);
            else res.status(500).json(result || { success:false, message:'Delete failed' });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    }

    // Presign: Generate signed PUT URL for S3 (requires STORAGE_TYPE=AWS_S3).
    async presign(req, res) {
        try {
            const storageType = envVar('STORAGE_TYPE');
            if (storageType !== 'AWS_S3') {
                return res.status(400).json({ success: false, message: 'Presign is only available when STORAGE_TYPE=AWS_S3' });
            }

            const { fileName, subFolder, contentType } = parseUploadRequest(req);
            if (!fileName) return res.status(400).json({ success: false, message: 'fileName is required' });

            const bucket = envVar('AWS_BUCKET');
            const region = envVar('AWS_REGION');
            const moviesFolder = envVar('MOVIES_FOLDER') || 'movies';
            const key = `${moviesFolder}/${subFolder ? subFolder + '/' : ''}${fileName}`;

            console.log(`[files.presign] name="${fileName}" sub="${subFolder}" ct="${contentType}" -> key="${key}"`);

            const url = this.s3().getSignedUrl('putObject', {
                Bucket: bucket,
                Key: key,
                ContentType: contentType,
                Expires: 900, // 15 minutes.
            });
            const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

            return res.status(200).json({
                success: true,
                url,
                method: 'PUT',
                headers: { 'Content-Type': contentType },
                objectKey: key,
                publicUrl
            });
        } catch (e) {
            console.error('[files.presign] error:', e);
            res.status(500).json({ success: false, message: e.message });
        }
    }

    // Finalize: Verify S3 object after upload (HEAD request).
    async finalize(req, res) {
        try {
            const storageType = envVar('STORAGE_TYPE');
            if (storageType !== 'AWS_S3') {
                return res.status(400).json({ success: false, message: 'Finalize is only available when STORAGE_TYPE=AWS_S3' });
            }

            const { objectKey, fileName, subFolder } = parseFinalizeRequest(req);
            if (!objectKey) return res.status(400).json({ success: false, message: 'objectKey is required' });

            const bucket = envVar('AWS_BUCKET');
            const region = envVar('AWS_REGION');

            const head = await this.s3().headObject({ Bucket: bucket, Key: objectKey }).promise();
            console.log(`[files.finalize] key="${objectKey}" size=${head.ContentLength} ct="${head.ContentType}" etag=${head.ETag}`);

            if (!head.ContentLength || head.ContentLength === 0) {
                return res.status(409).json({ success: false, message: 'Uploaded object is empty (0 bytes). Please retry.' });
            }

            const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${objectKey}`;

            return res.status(200).json({
                success: true,
                url: publicUrl,
                file_name: fileName || (objectKey.split('/').pop() ),
                subFolder: subFolder ?? null
            });
        } catch (e) {
            console.error('[files.finalize] error:', e);
            const msg = (e && e.code === 'NotFound') ? 'Object not found in S3 (upload may have failed)' : e.message;
            res.status(500).json({ success: false, message: msg });
        }
    }
}

// Export singleton instance.
module.exports = new filesController();