let db_engin_class = null;

switch (process.env.DB_TYPE) {
    case 'MONGO':
        db_engin_class = require('./mongo_db')
        break;

    case 'POSTGRES':
        db_engin_class = require('./pg_db')
        break;

    case 'LOCALSTORAGE':
        db_engin_class = require('./ls_db')
        break;
}

module.exports = new db_engin_class();
