const { deleteMovieFile, insertMovieToDB } = require('../services/movies');  // Assume new insert function
const s3Service = require('../services/s3Service');
const { getUserId } = require('../services/user');

class filesController {
    constructor() {}

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

    async confirmUpload(req, res) {  // New method
        try {
            const { fileName, url, deletable, subFolder } = req.body;
            const userId = getUserId(req.user);
            const result = await insertMovieToDB({ file_name: fileName, url, deletable, subFolder, userId });  // Insert to DB
            if (result.success) {
                res.status(200).json(result);
            } else {
                res.status(500).json(result);
            }
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    }

    async delete(req, res) {
        const { fileName, subFolder } = req.body;
        try {
            const result = await deleteMovieFile(fileName, subFolder);
            if (result.success) {
                res.status(200).json(result);
            } else {
                res.status(500).json(result);
            }
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    }
}

module.exports = new filesController();