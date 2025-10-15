'use strict';

const storage = require('../services/storage');
const { deleteMovieFile } = require('../services/movies');

/**
 * controllers/files.js
 * Upload: unchanged.
 * Delete: now works across legacy & per-user layouts; accepts key/filePath/name/file_name.
 */
class filesController {
  constructor() {}

  async upload(req, res) {
    try {
      const result = await storage.uploadFile(req, res);
      if (result && result.success) return res.status(200).json(result);
      return res.status(500).json(result || { success: false, message: 'Upload failed' });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  async delete(req, res) {
    try {
      const userId = req?.user?.id || req?.user?.user_id || null;
      const payload = {
        key: req.body?.key || req.query?.key,
        filePath: req.body?.filePath || req.query?.filePath,
        name: req.body?.name || req.query?.name,
        file_name: req.body?.file_name || req.query?.file_name,
        userId,
      };

      const result = await deleteMovieFile(payload);
      if (result && result.success) return res.status(200).json(result);
      // Return 200 with message to avoid breaking old UIs that expect success even if nothing to delete
      return res.status(200).json(result || { success: false, message: 'File not found' });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }
}

module.exports = new filesController();
