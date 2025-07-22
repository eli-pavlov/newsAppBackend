const express = require("express");
const config = require('config');  // use default.json in dev mode and production.json in build mode.
const dotenv = require('dotenv').config();  // add all variables defined in .env file to process.env (usage: process.env.VAR_NAME)
const dbRouter = require("./routes/db");
const authRouter = require("./routes/auth");
const settingsRouter = require("./routes/settings");
const userRouter = require("./routes/user");
const { initDB } = require('./services/db');

const cors = require('cors');
const path = require('path');

const app = express()

app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like curl or Postman)
        if (!origin) return callback(null, true);

        // You can allow all domains here — or check against a list
        // For total flexibility (use with caution in production):
        callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    maxAge: 600, // cache preflight for 10 minutes
    credentials: true,
    exposedHeaders: ['x-access-token', 'x-refresh-token'],
})); // Enable CORS for all origins

// *********** ROUTES *************************
app.use('/', settingsRouter);
app.use('/', authRouter);
app.use('/', dbRouter);
app.use('/', userRouter);

// fallback for all urls
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDB()
    .then(result => {
        if (result.success) {
            const appPort = config.get("app.port") || process.env.DEFAULT_APP_PORT;
            app.listen(appPort, async () => {
                console.log(`Server is listening on port ${appPort}`);
            })
        }
        else {
            console.log(result.message);
        }
    })
    .catch(e => {
        console.log(e);
    })
