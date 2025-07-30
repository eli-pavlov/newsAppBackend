const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const UserModel = require('../models/mongoose_user');
const SettingModel = require('../models/mongoose_setting');
const config = require('config');

class MONGOOSE_DB {
    constructor() {
        this.client = null;
    }

    async connect() {
        try {
            const configMongoUri = config.get(`${process.env.DB_CONFIG_KEY}.uri`); 
            const dbUri = process.env.MONGO_URI || configMongoUri;

            await mongoose.connect(dbUri);

            console.log(await this.initTables(false));

            return ({ success: true })
        }
        catch (e) {
            return ({ success: false, message: e.message });
        }
    }

    async initTables(recreateTables) {
        try {
            if (recreateTables) {
                console.log(await this.removeCollection(UserModel));
                console.log(await this.removeCollection(SettingModel));
            }

            console.log(await this.createCollection(UserModel));
            console.log(await this.createCollection(SettingModel));

            if (recreateTables)
                await this.insertData();

            return { success: true, message: 'All tables created successfully' };
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }

    async createCollection(model) {
        try {
            await model.createCollection();

            return { success: true, message: `Collection ${model.name} was created.` }
        }
        catch (e) {
            return { success: false, message: e.message }
        }
    }

    async removeCollection(model) {
        try {
            const collectionName = model.collection.collectionName;
            
            await mongoose.connection.db.dropCollection(collectionName);

            return { success: true, message: `Collection ${model.name} was removed.` }
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
            'role': 'Admin'
        };

        await this.insertRecord(UserModel, adminData);
    }

    async insertRecord(model, data) {
        try {
            await model.insertOne(data);

            return { success: true, message: `Data saved into collection ${model.name}` };
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }

    async updateRecord(model, _id, fieldName, data) {
        try {
            const filter = { _id: _id };
            const update = {
                $set: { [fieldName]: data },
            };

            const result = await model.updateOne(filter, update);

            return { success: true, message: `Data saved into collection ${model.name}` };
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
            const user = await UserModel.findOne(
                { email: email }
            );

            if (user) {
                const correctPassword = user.password ? await this.comparePassword(password, user.password) : false;

                if (correctPassword) {
                    return { success: true, data:user.toJSON()}
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

            const result = await SettingModel.findOne(
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

            const result = await SettingModel.findOne(
                {user_id: user._id}
            );

            if (result) {
                await this.updateRecord(SettingModel, result._id, 'data', data);
            }
            else {
                const user_id = user._id;
                await this.insertRecord(SettingModel, {user_id, data});
            }

            return { success: true, data: data };
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }

    async deleteSettings(userId) {
        try {
            await SettingModel.deleteOne(
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
            const users = await UserModel.find({});

            return { success: true, data:users }
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }

    async addUser(data) {
        try {
            // check if email exist
            const user = await UserModel.findOne(
                { email: data.email }
            );

            if (user)
                return { success: false, message:"Email already exist in system." }

            data.password = await this.hashPassword(data.password);

            await this.insertRecord(UserModel, data);

            return { success: true, data:data }
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }

    async deleteUser(email) {
        try {
            const user = await UserModel.findOne({ email: email });
            
            const userId = user._id.toString();

            await UserModel.deleteOne(
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

module.exports = MONGOOSE_DB
