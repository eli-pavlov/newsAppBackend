// controllers/settings.js
const settingsController = {
  async get(_req, res) {
    res.json({ theme: "light", language: "en" });
  },
  async update(req, res) {
    const body = req.body || {};
    res.json({ success: true, settings: body });
  }
};
module.exports = settingsController;
