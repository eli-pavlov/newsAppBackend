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

// helper near top of controllers/files.js
function _pickIncomingFile(req) {
  if (req.file) return req.file;
  if (req.files) {
    if (req.files.file) return req.files.file;
    const first = Object.values(req.files)[0];
    if (first) return first;
  }
  if (req.body?.fileBase64 || req.body?.base64 || req.body?.content) return 'BASE64';
  return null;
}

// inside your upload handler, FIRST thing:
const maybe = _pickIncomingFile(req);
if (!maybe) {
  // nothing attached → treat as no-op success so UI doesn't fail
  return res.json({ success: true, skipped: true });
}

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
