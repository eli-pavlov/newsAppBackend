const mysql = require('mysql2/promise');
const DB_BASE = require('./db_engin_base');

class MYSQL_DB extends DB_BASE {
    constructor() {
        super();
        this.connection = null;
    }

    async enginConnect(dbUri) {
        this.connection = await mysql.createConnection(dbUri);
    }

    async initTables(recreateTables) {
        try {
            if (recreateTables) {
                let result = await this.connection.execute('DROP TABLE IF EXISTS settings');
                
                result = await this.connection.execute('DROP TABLE IF EXISTS users');

                let sql = `
                    CREATE TABLE users (
                        id INT UNSIGNED auto_increment primary key,
                        name VARCHAR(50) NOT NULL,
                        email VARCHAR(50) NOT NULL,
                        password VARCHAR(100) NOT NULL,
                        role VARCHAR(20) NOT NULL,
                        editable BOOLEAN NOT NULL DEFAULT FALSE,
                        protected BOOLEAN NOT NULL DEFAULT TRUE
                    )
                `;
                result = await this.connection.execute(sql);

                sql = `
                    CREATE TABLE settings (
                        id INT UNSIGNED auto_increment primary key,
                        user_id INT UNSIGNED NOT NULL,
                        data JSON NOT NULL,
                        FOREIGN KEY (user_id) REFERENCES users(id) 
                    )
                `;
                result = await this.connection.execute(sql);

                await this.insertData();
            }

            return { success: true, message: 'All associations initialized and tables created successfully' };
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }

    async insertData() {
        const password = await this.hashPassword("1234");

        const sql = `
            INSERT INTO users 
            (name, email, password, role, editable, protected)
            VALUES 
                ('Admin', 'admin@admin.com', '${password}', 'Admin', '0', '1'),
                ('Editor', 'editor@editor.com', '${password}', 'Editor', '0', '1')
            ;
        `;

        const result = await this.connection.execute(sql);
    }

    async login(email, password) {
        try {
            const [rows] = await this.connection.execute(`SELECT * FROM users WHERE email = '${email}'`)

            if (rows.length > 0) {
                const user = rows[0];

                const userPassword = user.password;
                const correctPassword = userPassword ? (await this.comparePassword(password, userPassword) || (password === userPassword)) : false;

                if (correctPassword) {
                    return { success: true, data: user }
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
            if (!user || !user.id)
                return { success: false, message: "Unknown user." }

            const [rows] = await this.connection.execute(`SELECT * FROM settings WHERE user_id = '${user.id}'`);

            if (rows.length > 0) {
                return { success: true, data: rows[0].data }
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

            const [rows] = await this.connection.execute(`SELECT * FROM settings WHERE user_id = '${user.id}'`);

            if (rows.length > 0) {
                const id = rows[0].id;
                const result = await this.connection.execute(`UPDATE settings SET data = '${JSON.stringify(data)}' WHERE user_id = '${user.id}'`);
            }
            else {
                const sql = `
                        INSERT INTO settings 
                        (user_id, data)
                        VALUES ('${user.id}', '${JSON.stringify(data)}');
                    `;
                    
                const result = await this.connection.execute(sql);
            }

            return { success: true, data: data };
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }

    async deleteSettings(userId) {
        try {
            const result = await this.connection.execute(`DELETE FROM settings WHERE user_id = '${userId}'`);

            return { success: true }
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }

    async getAllUsers() {
        try {
            const [rows] = await this.connection.execute(`SELECT * FROM users`);

            return { success: true, data: rows }
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }

    async getProtectedUsers() {
        try {
            const [rows] = await this.connection.execute(`SELECT * FROM users WHERE protected = '1'`);

            return { success: true, data: rows }
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }

    async addUser(data) {
        try {
            // check if email exist
            const [rows] = await this.connection.execute(`SELECT * FROM users WHERE email = '${data.email}'`)

            if (rows.length > 0)
                return { success: false, message: "Email already exist in system." }

            data.password = await this.hashPassword(data.password);

            const sql = `
                    INSERT INTO users 
                    (name, email, password, role, editable, protected)
                    VALUES ('${data.name}', '${data.email}', '${data.password}', '${data.role}', '1', '0');
                `;
            const result = await this.connection.execute(sql);

            return { success: true, data: data }
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }

    async deleteUser(email) {
        try {
            // check if email exist
            const [rows] = await this.connection.execute(`SELECT * FROM users WHERE email = '${email}'`)

            if (rows.length > 0) {
                const user = rows[0];

                let result = await this.connection.execute(`DELETE FROM settings WHERE user_id = '${user.id}'`)
                result = await this.connection.execute(`DELETE FROM users WHERE id = '${user.id}'`)
            }
    
            return { success: true }
        }
        catch (e) {
            return { success: false, message: e.message };
        }
    }
}

module.exports = MYSQL_DB
