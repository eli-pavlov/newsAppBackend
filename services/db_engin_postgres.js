const seqClient = require('./sequelizeClient');
const User = require('../models/user')
const Setting = require('../models/setting')
const bcrypt = require('bcrypt');

class PG_DB {
    constructor() {
        this.client = seqClient;
    }

    async connect() {
        try {
            await this.client.authenticate();
            console.log(await this.initTables(false));

            return ({ success: true })
        }
        catch (e) {
            return ({ success: false, message: e.message });
        }
    }

    async initTables(recreateTables) {
        try {
            await this.client.sync({ force: recreateTables });  // create all tables from models

            await this.initializeAssociations();

            if (recreateTables)
                await this.insertData();

            return { success: true, message: 'All associations initialized and tables created successfully' };
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }

    async initializeAssociations() {
        // Initialize associations between models
        User.hasMany(Setting, {
            foreignKey: 'user_id',
            onDelete: 'CASCADE',
            hooks: true
        });

        Setting.belongsTo(User, {
            foreignKey: 'user_id',
            onDelete: 'CASCADE',
            as: 'st'
        });
    }

    async insertData() {
        const password = await this.hashPassword("1234");

        let adminData = {
            "id": 1,
            "name": "Admin",
            "email": "admin@admin.com",
            "password": password,
            "role": "Admin",
        }

        await this.insertRecord(User, adminData);
    }

    async insertRecord(model, data) {
        const now = new Date();
        data.createdAt = now;
        data.updatedAt = now;

        const result = await model.create(data);

        return result;
    }

    async updateRecord(model, data) {
        const now = new Date();
        data.updatedAt = now;

        const result = await model.update(
            data,
            {
                where: { id: data.id },
            },
        );

        return result;
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
            const user = await User.findOne(
                { where: { email: email } }
            );

            const userPassword = user?.dataValues?.password;

            const correctPassword = userPassword ? await this.comparePassword(password, userPassword) : false;

            if (correctPassword) {
                return { success: true, data: user.dataValues }
            }
            else
                return { success: false };

        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }

    async getSettings(user) {
        try {
            if (!user || !user.id)
                return { success: false, message: "Unknown user." }

            const result = await Setting.findOne(
                { where: { user_id: String(user.id) } }
            );

            if (result) {
                if (result?.dataValues?.data) {
                    return { success: true, data: result.dataValues.data }
                }
            }

            return { success: false, message: "User settings not found." }
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }

    async saveSettings(data, user) {
        try {
            if (!user || !user.id)
                return { success: false, message: "Unknown user." }

            const user_id = String(user.id);

            const result = await Setting.findOne(
                { where: { user_id: user_id } }
            );

            if (result) {
                const id = result.dataValues.id;
                await this.updateRecord(Setting, { id, data });
            }
            else {
                await this.insertRecord(Setting, { user_id, data });
            }

            return { success: true, data: data };
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }

    async deleteSettings(userId) {
        try {
            await Setting.destroy(
                { where: { user_id: String(userId) } }
            );

            return { success: true }
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }

    async getAllUsers() {
        try {
            const users = await User.findAll({});

            return { success: true, data: users }
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }

    async addUser(data) {
        try {
            // check if email exist
            const user = await User.findOne(
                { where: { email: data.email } }
            );

            if (user)
                return { success: false, message: "Email already exist in system." }

            data.password = await this.hashPassword(data.password);

            await this.insertRecord(User, data);

            return { success: true, data: data }
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }

    async deleteUser(email) {
        try {
            await User.destroy(
                { where: { email: email } }
            );

            return { success: true }
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }
}

module.exports = PG_DB
