// backend/app.js (added explicit 0.0.0.0 bind + startup log; minor env fallback)
const express = require("express");
const dotenv = require('dotenv').config();
const { envVar } = require('./services/env');
const dbRouter = require("./routes/db");
const authRouter = require("./routes/auth");
const settingsRouter = require("./routes/settings");
const userRouter = require("./routes/user");
const filesRouter = require("./routes/files");
const { initDB } = require('./services/db');
const authMiddleware = require('./middleware/authToken')
const cors = require('cors');
const path = require('path');

const app = express()

app.use(express.json())

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public', 'app')));

if (envVar('STORAGE_TYPE') === 'DISK') {
    const moviesFolderName = envVar('MOVIES_FOLDER');
    app.use(`/${moviesFolderName}`, express.static(`${envVar('DISK_ROOT_PATH')}/${moviesFolderName}`));
}

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
app.use('/settings', authMiddleware.verifyAuthToken, settingsRouter);
app.use('/auth', authRouter);
app.use('/db', dbRouter);
app.use('/user', authMiddleware.verifyAuthTokenAndAdmin, userRouter);
app.use('/files', filesRouter);

app.get('/config', (req, res) => {
    try {
        let appEnvVariables = {};

        Object.keys(process.env).forEach(e => {
            if (e.toUpperCase().startsWith('VITE_'))
                appEnvVariables[e] = process.env[e];
        })

        res.status(200).json({ success: true, data: appEnvVariables });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message, data: {} })
    }
})

// fallback for all routes
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'app', 'index.html'));
});

initDB()
    .then(result => {
        if (result.success) {
            const appPort = envVar("APP_PORT") || process.env.PORT || 3000;
            const appHost = '0.0.0.0'; // Explicitly bind to all interfaces for Docker/CI
           
            app.listen(appPort, appHost, async () => {
                console.log(`Server is listening on ${appHost}:${appPort}`); // Startup log for debugging
            })
        }
        else {
            console.log(result.message);
        }
    })
    .catch(e => {
        console.log(e);
    })