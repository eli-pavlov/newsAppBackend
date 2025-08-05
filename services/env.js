const config = require('config');

function envVar(key) {
    try {
        key = key.toUpperCase();

        return process.env[key] || config.get(key);
    }
    catch(e) {
        return null;
    }
}

module.exports = {
    envVar
}