const AWS = require('aws-sdk');
const { envVar } = require('../services/env');
const { deleteMovieFile } = require('../services/movies');
const storage = require('../services/storage');

function firstNonEmpty(...vals) {
    for (const v of vals) {
        if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return undefined;
}

function decodeMaybe(v) {
    if (typeof v !== 'string') return v;
    try { return decodeURIComponent(v); } catch { return v; }
}

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

class filesController {
    constructor() {
        this._s3 = null;

        // 🔧 bind handlers so `this` is preserved when Express calls them
        this.upload   = this.upload.bind(this);
        this.delete   = this.delete.bind(this);
        this.presign  = this.presign.bind(this);
        this.finalize = this.finalize.bind(this);
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

    // Legacy upload (kept for DISK mode)
    async upload(req, res) {
        try {
            const result = await storage.uploadFile(req, res);
            if (result && result.success) res.status(200).json(result);
            else res.status(500).json(result || { success:false, message:'Upload failed' });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    }

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
                Expires: 900,
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
                file_name: fileName || (objectKey.split('/').pop()),
                subFolder: subFolder ?? null
            });
        } catch (e) {
            console.error('[files.finalize] error:', e);
            const msg = (e && e.code === 'NotFound') ? 'Object not found in S3 (upload may have failed)' : e.message;
            res.status(500).json({ success: false, message: msg });
        }
    }
}

module.exports = new filesController();
