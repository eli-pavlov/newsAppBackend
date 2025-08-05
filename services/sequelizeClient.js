const { Sequelize } = require('sequelize');
const config = require("config");

let seqClient = null;

try {
    let configDbUri = null;
    let dbConnectionKey = envVar("DB_CONNECTION_KEY");
    if (dbConnectionKey) {
        configDbUri = envVar(dbConnectionKey);
    }

    const options =
    {
        // dialectOptions: {
        //     ssl: {
        //         require: true,
        //         rejectUnauthorized: false, // Required for services like Render
        //     }
        // }
    }

    seqClient = new Sequelize(envVar("DB_URI") || configDbUri, options);
}
catch (e) {
    console.error(e.message);
}

module.exports = seqClient;
