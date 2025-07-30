const { db } = require('../services/db');
const jwt = require('jsonwebtoken');

class authController {
    constructor() {
    }

    async verify(req, res) {
        res.status(200).json({success:true, user:req.user});
    }

    async login(req, res) {
        try {
            const { email, password } = req.body;
            

            const result = await db.login(email, password);

            if (result.success) {
                const user = result.data;
                const secret = process.env.JWT_SECRET_KEY;

                const auth_token = jwt.sign(user, secret, { expiresIn: process.env.JWT_EXPIRATION_PERIOD });

                result.tokens = {
                    auth_token: auth_token,
                }

                res.status(200).json(result)
            }
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
