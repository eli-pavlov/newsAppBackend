const bcrypt = require('bcrypt');
const config = require('config');

class DB_BASE {
    constructor() {
    }

    async connect() {
        try {
            let configDbUri = config.get(`${process.env.DB_CONFIG_KEY}.uri`);
            configDbUri = configDbUri.replaceAll('{~}', '');
            const dbUri = process.env.DB_URI || configDbUri;

            await this.enginConnect(dbUri);

            console.log(await this.initTables(false));
            
            return ({ success: true })
        }
        catch (e) {
            return ({ success: false, message: e.message });
        }
    }

    async enginConnect(dbUri) {
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
