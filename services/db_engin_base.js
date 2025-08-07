const bcrypt = require('bcrypt');
const config = require('config');
const { envVar } = require('../services/env');

class DB_BASE {
    constructor() {
    }

    async connect() {
        try {
            let configDbUri = null;
            let dbConnectionKey = envVar("DB_CONNECTION_KEY");
            if (dbConnectionKey) {
                configDbUri = envVar(dbConnectionKey);
                configDbUri = configDbUri.replaceAll('{~}', '');
            }

            const dbUri = envVar("DB_URI") || configDbUri;

            await this.enginConnect(dbUri);

            await this.createTables();

            console.log(await this.initTables(false));
            
            return ({ success: true })
        }
        catch (e) {
            return ({ success: false, message: e.message });
        }
    }

    async enginConnect(dbUri) {
    }

    async createTables() {
    }

    async initTables(recreateTables) {
    }

    async insertData() {
    }

    async hashPassword(password) {
        return bcrypt.hash(password, 10);
    }

    async comparePassword(password, hasPassword) {
        const result = await bcrypt.compare(password, hasPassword)

        return result;
    }

    async login(email, password) {
    }

    async getSettings(user) {
    }

    async saveSettings(data, user) {
    }

    async deleteSettings(userId) {
    }

    async getAllUsers() {
    }

    async getProtectedUsers() {
    }

    async addUser(data) {
    }

    async deleteUser(email) {
    }
}

module.exports = DB_BASE
