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

function parseUploadRequest(req) {
    // Support JSON body, querystring, or headers (for FormData/edge cases)
    const body = (req && req.body) ? req.body : {};
    const query = (req && req.query) ? req.query : {};
    const hdr = (req && req.headers) ? req.headers : {};

    const fileName = firstNonEmpty(
        body.fileName, body.filename, body.name,
        query.fileName, query.filename, query.name,
        hdr['x-file-name'], hdr['x-filename']
    );

    const subFolderRaw = firstNonEmpty(
        body.subFolder, query.subFolder, hdr['x-sub-folder']
    );
    const subFolder = (subFolderRaw === 'null' || subFolderRaw === 'undefined') ? null : subFolderRaw;

    // Prefer explicit contentType; fall back to header if client passed it there; otherwise default
    const explicitCT = firstNonEmpty(
        body.contentType, body.mimeType,
        query.contentType, query.mimeType,
        hdr['x-content-type']
    );
    // NOTE: req.headers['content-type'] may be multipart/form-data, which is NOT the file's type.
    // We only use it if nothing else was provided and it's not a multipart envelope.
    let contentType = explicitCT;
    if (!contentType) {
        const hct = hdr['content-type'];
        if (hct && !/^multipart\/form-data/i.test(hct)) {
            contentType = hct.split(';')[0];
        }
    }
    if (!contentType) contentType = 'application/octet-stream';

    return { fileName, subFolder, contentType };
}

function parseFinalizeRequest(req) {
    const body = (req && req.body) ? req.body : {};
    const query = (req && req.query) ? req.query : {};
    const hdr = (req && req.headers) ? req.headers : {};

    const objectKey = firstNonEmpty(
        body.objectKey, query.objectKey, hdr['x-object-key']
    );

    const fileName = firstNonEmpty(
        body.fileName, body.filename, body.name,
        query.fileName, query.filename, query.name,
        hdr['x-file-name'], hdr['x-filename']
    );

    const subFolderRaw = firstNonEmpty(
        body.subFolder, query.subFolder, hdr['x-sub-folder']
    );
    const subFolder = (subFolderRaw === 'null' || subFolderRaw === 'undefined') ? null : subFolderRaw;

    return { objectKey, fileName, subFolder };
}

class filesController {
    constructor() {
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

    // Legacy upload (kept for DISK mode)
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

    // New: presign for direct S3 PUT
    async presign(req, res) {
        try {
            const storageType = envVar('STORAGE_TYPE');
            if (storageType !== 'AWS_S3') {
                return res.status(400).json({ success: false, message: 'Presign is only available when STORAGE_TYPE=AWS_S3' });
            }

            const { fileName, subFolder, contentType } = parseUploadRequest(req);
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
                Expires: 900, // 15 min
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
            res.status(500).json({ success: false, message: e.message });
        }
    }

    // Verify uploaded object and return normalized shape
    async finalize(req, res) {
        try {
            const storageType = envVar('STORAGE_TYPE');
            if (storageType !== 'AWS_S3') {
                return res.status(400).json({ success: false, message: 'Finalize is only available when STORAGE_TYPE=AWS_S3' });
            }

            const { objectKey, fileName, subFolder } = parseFinalizeRequest(req);
            if (!objectKey) {
                return res.status(400).json({ success: false, message: 'objectKey is required' });
            }

            const bucket = envVar('AWS_BUCKET');
            const region = envVar('AWS_REGION');

            // HEAD the object; throw if missing
            const head = await this.s3().headObject({ Bucket: bucket, Key: objectKey }).promise();

            // Optional: reject zero-byte "ghost" objects
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
            const msg = (e && e.code === 'NotFound') ? 'Object not found in S3 (upload may have failed)' : e.message;
            res.status(500).json({ success: false, message: msg });
        }
    }
}

module.exports = new filesController();
