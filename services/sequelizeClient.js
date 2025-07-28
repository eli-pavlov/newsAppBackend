const { Sequelize } = require('sequelize');
const config = require("config");

let seqClient = null;

try {
    const configPostgresUri = config.get(
        `${process.env.DB_CONFIG_KEY}.uri`,
        {
            // dialectOptions: {
            //     ssl: {
            //         require: true,
            //         rejectUnauthorized: false, // Required for services like Render
            //     }
            // }
        }
    );

    seqClient = new Sequelize(process.env.POSTGRES_URI || configPostgresUri);
}
catch (e) {
    console.error(e.message);
}

module.exports = seqClient;
