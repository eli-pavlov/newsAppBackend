// controllers/files.js
const { listFiles } = require("../services/db");

const filesController = {
  async list(_req, res) {
    try {
      const files = await listFiles();
      res.json({ success: true, files });
    } catch (err) {
      console.error("files.list error:", err);
      res.status(500).json({ success: false, message: "Failed to list files" });
    }
  },
  async upload(_req, res) { res.status(501).json({ success: false, message: "Not implemented" }); },
  async delete(_req, res) { res.status(501).json({ success: false, message: "Not implemented" }); },
  async presign(_req, res) { res.status(501).json({ success: false, message: "Not implemented" }); },
  async finalize(_req, res) { res.status(501).json({ success: false, message: "Not implemented" }); },
};

module.exports = filesController;
