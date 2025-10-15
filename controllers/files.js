const { deleteMovieFile } = require('../services/movies');
const storage = require('../services/storage');
const movies = require('../services/movies');

exports.delete = async (req, res) => {
  try {
    const fileName = req.body.fileName || req.body.filename || req.body.name;
    // prefer explicit subFolder from client; otherwise infer current user
    let subFolder = req.body.subFolder ?? req.body.userId ?? null;
    if (subFolder == null && req.user?.id) subFolder = String(req.user.id);

    const result = await movies.deleteMovieFile(fileName, subFolder);
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

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
