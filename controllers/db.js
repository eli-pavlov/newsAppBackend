const { getDbAvailable } = require('../services/db');
// const auth = require("../middleware/auth");

class dbController {
    constructor() {
    }

    async available(req, res) {
        try {
            if (getDbAvailable().success)
                res.status(200).json(getDbAvailable())
            else {
                getDbAvailable().message = dbAvailable.message ?? "Database is not available.";
                res.status(500).json(getDbAvailable())
            }
        }
        catch (e) {
            res.status(500).json({ success: false, message: e.message })
        }
    }
}

module.exports = new dbController();
