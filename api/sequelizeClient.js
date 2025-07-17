const { Sequelize } = require('sequelize');
const config = require("config");

let seqClient = null;

try {
    const dbName = process.env.POSTGRES_DB || config.get("db_pg.database");
    const userName = process.env.POSTGRES_USER || config.get("db_pg.username");
    const password = process.env.POSTGRES_PASSWORD || config.get("db_pg.password");

    const connectionData = {
        host: process.env.POSTGRES_HOST || config.get("db_pg.host"),
        port: process.env.POSTGRES_PORT || config.get("db_pg.port"),
        dialect: 'postgres',
        dialectOptions: {
            // ssl: {
            //     require: true,
            //     rejectUnauthorized: false, // Required for services like Render
            // }
        },
        logging: false, // optional, disable logging
    }

    seqClient = new Sequelize(dbName, userName, password, connectionData);
}
catch (e) {
    console.error(e.message);
}

module.exports = seqClient;
