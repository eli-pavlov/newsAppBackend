const { Sequelize } = require('sequelize');
const config = require("config");

let seqClient = null;

try {
    const configDbUri = config.get(
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

    seqClient = new Sequelize(process.env.DB_URI || configDbUri);
}
catch (e) {
    console.error(e.message);
}

module.exports = seqClient;
