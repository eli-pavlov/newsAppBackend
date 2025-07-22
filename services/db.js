let db_engin_class = null;
let dbAvailable = null;

switch (process.env.DB_TYPE) {
    case 'MONGO':
        db_engin_class = require('./db_engin_mongo')
        break;

    case 'POSTGRES':
        db_engin_class = require('./db_engin_postgres')
        break;

    case 'LOCALSTORAGE':
        db_engin_class = require('./db_engin_ls')
        break;
}
const db = new db_engin_class();

function getDbAvailable() {
    return dbAvailable;
}

async function initDB() {
    return new Promise(async (resolve, reject) => {
        try {
            dbAvailable = await db.connect();
            
            const msg = dbAvailable.success ? "DB connection is available." : `DB connection failed. {${dbAvailable.message}}`;
            console.log(msg);
            resolve({ success: true, message: msg});
        }
        catch (e) {
            reject({ success: false, message: e.message })
        }
    })
}

module.exports = {
    db,
    getDbAvailable,
    initDB
};
