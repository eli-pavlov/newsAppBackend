const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require('bcrypt');
const config = require('config');

class MONGO_DB {
    constructor() {
        this.db = null;
    }

    async connect() {
        try {
            const dbHost = process.env.MONGO_HOST || config.get("db_mongo.host");
            let dbUri = null;
            if (dbHost.startsWith('mongodb'))
                dbUri = `${dbHost}`;
            else
                dbUri = `mongodb://${dbHost}:${config.get("db_mongo.port")}`;
            
            console.log(dbUri);
            this.client = new MongoClient(dbUri);
            console.log("11111");
            await this.client.connect();
            console.log("22222");

            await this.initTables(false);
            console.log("3333");

            return { success: true }
        }
        catch (e) {
            return { success: false, message: e.message }
        }
    }

    async initTables(recreateTables) {
        try {
            const dbName = process.env.MONGO_DB_NAME || config.get("db_mongo.name")
            this.db = this.client.db(dbName);

            if (recreateTables) {
                await this.removeCollection('users');
                await this.removeCollection('settings');
            }

            await this.createCollection('users');
            await this.createCollection('settings');

            if (recreateTables)
                await this.insertData();

            return { success: true, message: 'All tables created successfully' };
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }

    async createCollection(collectionName) {
        try {
            const collection = this.db.createCollection(collectionName);

            return { success: true, message: `Collection ${collectionName} was created.` }
        }
        catch (e) {
            return { success: false, message: e.message }
        }
    }

    async removeCollection(collectionName) {
        try {
            this.db.dropCollection(collectionName);

            return { success: true, message: `Collection ${collectionName} was removed.` }
        }
        catch (e) {
            return { success: false, message: e.message }
        }
    }

    async insertData() {
        const password = await this.hashPassword("1234");

        const adminData = {
            'email': 'admin@admin.com',
            'password': password
        };

        await this.insertRecord("users", adminData);
    }

    async insertRecord(collectionName, data) {
        try {
            await this.db.collection(collectionName).insertOne(data);

            return { success: true, message: `Data saved into collection ${collectionName}` };
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }

    async updateRecord(collectionName, _id, fieldName, data) {
        try {
            const filter = { _id: _id };
            const update = {
                $set: { [fieldName]: data },
            };

            const result = await this.db.collection(collectionName).updateOne(filter, update);

            return { success: true, message: `Data saved into collection ${collectionName}` };
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }

    async hashPassword(password) {
        return bcrypt.hash(password, 10);
    }

    async comparePassword(password, hasPassword) {
        const result = await bcrypt.compare(password, hasPassword)

        return result;
    }

    async login(email, password) {
        try {
            const user = await this.db.collection('users').findOne(
                { email: email }
            );

            if (user) {
                const correctPassword = user.password ? await this.comparePassword(password, user.password) : false;

                if (correctPassword) {
                    return { success: true }
                }
            }
            return { success: false };
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }

    async getSettings() {
        try {
            const result = await this.db.collection('settings').findOne(
            );

            if (result) {
                if (result?.data) {
                    return { success: true, data: result.data }
                }
            }
            return { success: false};
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }

    async saveSettings(data) {
        try {
            const firstRecord = await this.db.collection('settings').findOne(
            );

            if (firstRecord) {
                await this.updateRecord('settings', firstRecord._id, 'data', data);
            }
            else {
                await this.insertRecord('settings', {data: data});
            }

            return { success: true, data: data };
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }
}

module.exports = MONGO_DB
