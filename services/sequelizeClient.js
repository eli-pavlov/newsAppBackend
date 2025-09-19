const { Sequelize } = require('sequelize');
const { getDBconnectionString } = require('../services/env');

let seqClient = null;

try {
    let dbConnectionString = getDBconnectionString();

    const options =
    {
        // dialectOptions: {
        //     ssl: {
        //         require: true,
        //         rejectUnauthorized: false, // Required for services like Render
        //     }
        // }
    }

    seqClient = new Sequelize(dbConnectionString, options);
}
catch (e) {
    console.error(e.message);
}

module.exports = seqClient;
