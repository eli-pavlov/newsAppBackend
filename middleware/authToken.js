const jwt = require('jsonwebtoken');
const { envVar } = require('../services/env');

function validToken(token) {
    return new Promise((resolve, reject) => {
        jwt.verify(token, envVar("JWT_SECRET_KEY"), (err, decoded) => {
            if (err)
                resolve(false);
        
            resolve(decoded);
        });
    });
}

async function verifyAuthToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];

    const result = await validToken(token);

    if (!result)
        return res.status(403).json({ success:false, message: 'Invalid or expired token' });

    req.user = result;
    next();
}

async function verifyAuthTokenAndAdmin(req, res, next) {
    const skipValidationRoutes = ['/protected'];

    if (skipValidationRoutes.includes(req.path)) {
        next();
        return;
    }

    const token = req.headers['authorization']?.split(' ')[1];

    const result = await validToken(token);

    if (!result)
        return res.status(403).json({ success:false, message: 'Invalid or expired token' });

    if (result.role.toLowerCase() === 'admin') {
        req.user = result;
        next();
    }
    else {
        return res.status(403).json({ success:false, message: "Access denied. User has no permissions."});
    }
}

module.exports = {
    verifyAuthToken,
    verifyAuthTokenAndAdmin
}
