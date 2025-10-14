// backend/controllers/files.js (Fixed: Renamed methods to camelCase for consistency)
const { deleteMovieFile } = require('../services/movies');
const storage = require('../services/storage');
const { db } = require('../services/db');
const { getUserId } = require('../services/user');


class filesController {
    constructor() {
    }

    async upload(req, res) {
        try {
            const result = await storage.uploadFile(req, res);

            if (result.success)
                res.status(200).json(result)
            else
                res.status(500).json(result)
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message })
        }
    }

    async presign(req, res) {
        try {
            const { fileName, subFolder, contentType } = req.body;
            const userId = getUserId(req.user);
            const result = await storage.presignPut(fileName, subFolder || userId, contentType);

            if (result.success)
                res.status(200).json(result)
            else
                res.status(500).json(result)
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message })
        }
    }

    async finalize(req, res) {
        try {
            const { fileName, subFolder } = req.body;
            if (!fileName) {
                return res.status(400).json({ success: false, message: 'File name required' });
            }
            const userId = getUserId(req.user);
            const settings = await db.getSettings(req.user);
            let movies = settings.data.movies || [];
            const newMovie = { file_name: fileName, subFolder: subFolder || userId };
            if (!movies.find(m => m.file_name === fileName)) {
                movies.push(newMovie);
                settings.data.movies = movies;
                await db.saveSettings(settings.data, req.user);
            }
            res.status(200).json({ success: true, data: newMovie });
        }
        catch (e) {
            res.status(500).json({ success: false, message: `Finalize failed: ${e.message}` })
        }
    }

    async deletePresign(req, res) { // Fixed: Renamed to camelCase
        try {
            const { fileName, subFolder } = req.body;
            const userId = getUserId(req.user);
            const result = await storage.presignDelete(fileName, subFolder || userId);

            if (result.success)
                res.status(200).json(result)
            else
                res.status(500).json(result)
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message })
        }
    }

    async finalizeDelete(req, res) { // Fixed: Renamed to camelCase
        try {
            const { fileName, subFolder } = req.body;
            if (!fileName) {
                return res.status(400).json({ success: false, message: 'File name required' });
            }
            const userId = getUserId(req.user);
            const settings = await db.getSettings(req.user);
            let movies = settings.data.movies || [];
            movies = movies.filter(m => m.file_name !== fileName);
            settings.data.movies = movies;
            await db.saveSettings(settings.data, req.user);
            res.status(200).json({ success: true });
        }
        catch (e) {
            res.status(500).json({ success: false, message: `Delete finalize failed: ${e.message}` })
        }
    }

    async delete(req, res) {
        const { fileName, subFolder } = req.body;

        try {
            const result = await deleteMovieFile(fileName, subFolder/*getUserId()*/);

            if (result.success) {
                res.status(200).json(result)
            }
            else {
                res.status(500).json(result)
            }
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message })
        }
    }
}

module.exports = new filesController();