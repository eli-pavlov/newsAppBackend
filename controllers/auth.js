// controllers/auth.js
const authController = {
  async login(_req, res) {
    res.json({ success: true, token: "test-token" });
  },
  async logout(_req, res) {
    res.json({ success: true });
  }
};
module.exports = authController;
