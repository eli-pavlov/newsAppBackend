// controllers/settings.js
const settingsController = {
  async get(req, res) {
    // Provide a minimal settings payload so routes/settings works.
    res.json({ theme: "light", language: "en" });
  },
  async update(req, res) {
    // Accept and echo settings.
    const body = req.body || {};
    res.json({ success: true, settings: body });
  }
};
module.exports = settingsController;
