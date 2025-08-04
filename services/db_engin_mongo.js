const { MongoClient } = require("mongodb");
const DB_BASE = require('./db_engin_base');

class MONGO_DB extends DB_BASE {
    constructor() {
        super();
        this.db = null;
    }

    async enginConnect(dbUri) {
        this.client = new MongoClient(dbUri);
        
        await this.client.connect();
    }

    async initTables(recreateTables) {
        try {
            this.db = this.client.db();

            if (recreateTables) {
                console.log(await this.removeCollection('users'));
                console.log(await this.removeCollection('settings'));
            }

            console.log(await this.createCollection('users'));
            console.log(await this.createCollection('settings'));

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
        console.log(collection);

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
            'name': 'Admin',
            'email': 'admin@admin.com',
            'password': password,
            'role': 'Admin',
            'editable': false,
            'protected': true
        };

        await this.insertRecord('users', adminData);

        const editorData = {
            'name': 'Editor',
            'email': 'editor@editor.com',
            'password': password,
            'role': 'Editor',
            'editable': false,
            'protected': true
        };

        await this.insertRecord('users', editorData);
    }

    async insertRecord(collectionName, data) {
        try {
            const result = await this.db.collection(collectionName).insertOne(data);
            console.log(result);

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

    async login(email, password) {
        try {
            const user = await this.db.collection('users').findOne(
                { email: email }
            );

            if (user) {
                const correctPassword = user.password ? (await this.comparePassword(password, user.password) || (password === user.password)) : false;

                if (correctPassword) {
                    return { success: true, data:user }
                }
            }
            return { success: false };
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }

    async getSettings(user) {
        try {
            if (!user || !user._id)
                return { success: false, message: "Unknown user." }

            const result = await this.db.collection('settings').findOne(
                {user_id: user._id}
            );

            if (result) {
                if (result?.data)
                    return { success: true, data: result.data }
            }

            return { success: false, message: "User settings not found." }
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }

    async saveSettings(data, user) {
        try {
            if (!user || !user._id)
                return { success: false, message: "Unknown user." }

            const result = await this.db.collection('settings').findOne(
                {user_id: user._id}
            );

            if (result) {
                await this.updateRecord('settings', result._id, 'data', data);
            }
            else {
                const user_id = user._id;
                await this.insertRecord('settings', {user_id, data});
            }

            return { success: true, data: data };
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }

    async deleteSettings(userId) {
        try {
            await this.db.collection('settings').deleteOne(
                { user_id: userId }
            );

            return { success: true }
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }

    async getAllUsers() {
        try {
            const users = await this.db.collection('users').find({}).toArray();

            return { success: true, data:users }
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }

    async getProtectedUsers() {
        try {
            const users = await this.db.collection('users').find({ protected: true }).toArray();
            
            return { success: true, data:users }
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }

    async addUser(data) {
        try {
            // check if email exist
            const user = await this.db.collection('users').findOne(
                { email: data.email }
            );

            if (user)
                return { success: false, message:"Email already exist in system." }

            data.password = await this.hashPassword(data.password);
            data.editable = true;
            data.protected = false;

            await this.insertRecord('users', data);

            return { success: true, data:data }
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }

    async deleteUser(email) {
        try {
            const user = await this.db.collection('users').findOne({ email: email });
            
            const userId = user._id.toString();

            await this.db.collection('users').deleteOne(
                { email: email }
            );

            await this.deleteSettings( userId );

            return { success: true }
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }
}

module.exports = MONGO_DB
