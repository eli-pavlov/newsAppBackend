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
            await this.initTables(false);

            return ({success:true})
        }
        catch (e) {
            return({success:false, message:e.message});
        }
    }

    async initTables(recreateTables) {
        try {
            await this.client.sync({force: recreateTables});  // create all tables from models
            // if (!recreateTables)
            //     await this.initializeAssociations();

            if (recreateTables)
                await this.insertData();

            return {success:true, message:'All associations initialized and tables created successfully'};
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
            "password":password,
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
                where: {id: data.id},
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
                { where: {email: email} }
            );

            const userPassword = user?.dataValues?.password;

            const correctPassword = userPassword ? await this.comparePassword(password, userPassword) : false;

            if (correctPassword) {
                return {success:true}
            }
            else
                return {success:false};

        }
        catch(e) {
            return {success:false, message:e.message};
        }     
    }

    async getSettings() {
        try {
            const result = await Setting.findOne();

            if (result) {
                if (result?.dataValues?.data) {
                    return {success:true, data:result.dataValues.data}
                }
            }
            return {success:false};
        }
        catch(e) {
            return {success:false, message:e.message};
        }     
    }

    async saveSettings(data) {
        try {
            const firstRecord = await Setting.findOne(
            );

            if (firstRecord) {
                const id = firstRecord.dataValues.id;
                await this.updateRecord(Setting, {id, data});
            }
            else {
                await this.insertRecord(Setting, {data});
            }

            return {success:true, data:data};
        }
        catch(e) {
            return {success:false, message:e.message};
        }     
    }
}

module.exports = PG_DB
