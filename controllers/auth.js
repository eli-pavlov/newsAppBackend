const { db } = require('../services/db');
// const auth = require("../middleware/auth");

class authController {
    constructor() {
    }

    async login(req, res) {
        try {
            const { email, password } = req.body;

            const result = await db.login(email, password);

            if (result.success)
                res.status(200).json(result)
            else {
                result.message = result.message ?? "Wrong email or password.";
                res.status(500).json(result)
            }
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message })
        }
    }
}

module.exports = new authController();
