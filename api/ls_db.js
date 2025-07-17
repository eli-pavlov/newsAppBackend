const bcrypt = require('bcrypt');
const LocalStorage = require('node-localstorage').LocalStorage;
const localStorage = new LocalStorage('./local-storage');

class LS_DB {
    constructor() {
        this.LS_LOGIN_KEY = 'user';
        this.LS_SETTINGS_KEY = 'settings';
    }

    async connect() {
        try {
            await this.initTables(false);

            return ({success:true})
        }
        catch (e) {
            return({success:false, message:e.message});
        }
    }

    async initTables(recreateTables) {
        try {
            if (recreateTables) {
                localStorage.clear();
                await this.insertData();
            }

            return {success:true, message:'All tables created successfully'};
        }
        catch (e) {
            return {success:false, message:e.message};
        }
    }

    async insertData() {
        const password = await this.hashPassword("1234");

        let adminData = {
            "id": 1,
            "email":"admin@admin.com",
            "password": password,
        }

        localStorage.setItem(this.LS_LOGIN_KEY, JSON.stringify(adminData));
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
            let user = localStorage.getItem(this.LS_LOGIN_KEY);

            if (user) {
                user = JSON.parse(user);
            
                const correctPassword = user?.password ? await this.comparePassword(password, user.password) : false;

                if (correctPassword && (email === user.email)) {
                    return {success:true}
                }
            }

            return {success:false};
        }
        catch(e) {
            return {success:false, message:e.message};
        }     
    }

    async getSettings() {
        try {
            const result =localStorage.getItem(this.LS_SETTINGS_KEY);

            if (result) {
                return {success:true, data:JSON.parse(result)}
            }
            return {success:false};
        }
        catch(e) {
            return {success:false, message:e.message};
        }     
    }

    async saveSettings(data) {
        try {
            localStorage.removeItem(this.LS_SETTINGS_KEY);
            localStorage.setItem(this.LS_SETTINGS_KEY, JSON.stringify(data));

            return {success:true, data:data};
        }
        catch(e) {
            return {success:false, message:e.message};
        }     
    }
}

module.exports = LS_DB
