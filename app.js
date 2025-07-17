const express = require("express");
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');

const app = express()
app.use(express.json())
// Set 'public' as the static public folder
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

const config = require('config');  // use default.json i dev mode and production.json in build mode.
const dotenv = require('dotenv');  // add all variables defined in .env file to process.env (usage: process.env.VAR_NAME)
dotenv.config();

const db = require('./api/db');

// const authenticate = require('./middleware/auth');

// *********** ROUTES *************************

app.get('/db-available', async (req, res) => {
    try {
        if (dbAvailable.success)
            res.status(200).json(result)
        else {
            result.message = result.message?? "Database is not available.";
            res.status(500).json(result)
        }
    }
    catch (e) {
        res.status(500).json({success:true, message:e.message})
    }
})

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const result = await db.login(email, password);
        
        if (result.success)
            res.status(200).json(result)
        else {
            result.message = result.message?? "Wrong email or password."; 
            res.status(500).json(result)
        }
    }
    catch (e) {
        res.status(500).json({success:false, message:e.message})
    }
})

app.get('/settings', async (req, res) => {
    try {
        const result = await db.getSettings();
        
        // get the movies files list from server folder
        const folderMovies = await getMoviesList();

        if (result.success) {
            // get the saved movies list
            const settingsMovies = result.data.movies.map(item => item.file_name);

            // get the movies files list that were removed from server folder since last save 
            const missingFiles = settingsMovies.filter(f => !folderMovies.includes(f));

            // find the new files that added to server folder
            const newFiles = folderMovies.filter(f => !settingsMovies.includes(f));

            // create the updated movies list 
            // get only the saved files that are still exists in server folder (ignore the removed files)
            let finalSettingsMoviesList = result.data.movies.filter(item => !missingFiles.includes(item.file_name));

            // add the new movies files
            newFiles.forEach(f => {
                finalSettingsMoviesList.push({
                    file_name:f, 
                });
            })

            // add the full url for each movie file
            finalSettingsMoviesList.forEach(f => {
                f.url = `${req.protocol}://${req.get('host')}/assets/movies/${f.file_name}`
            })

            result.data.movies = finalSettingsMoviesList;
            res.status(200).json(result)
        }
        else {
            // in case there is no saved settings, return also the server movies files
            const folderFilesList = folderMovies.map(f => ({
                file_name:f, 
                url:`${req.protocol}://${req.get('host')}/assets/movies/${f}`,
            }));

            result.movies = folderFilesList;
            result.message = result.message?? "Get settings failed.";
            res.status(500).json(result)
        }
    }
    catch (e) {
        res.status(500).json({success:true, message:e.message})
    }
})

app.post('/settings', async (req, res) => {
    try {
        const data = req.body;
        
        const result = await db.saveSettings(data);
        
        if (result.success)
            res.status(200).json(result)
        else
            res.status(500).json(result)
    }
    catch (e) {
        res.status(500).json({success:true, message:e.message})
    }
})

async function getMoviesList() {
    const moviesFolder = 'assets/movies';
    const folderPath = path.join(__dirname, `public/${moviesFolder}`);

    try {
        const files = await fs.readdir(folderPath);
        // const output = files.map(f => { return {file_name:f, url:`${serverUrl}/${moviesFolder}/${f}`} })
        return files;
    }
    catch (e) {
        console.log(e.message);

        return [];
    }
}

let dbAvailable = null;
async function initDB() {
    dbAvailable = await db.connect();
    console.log(dbAvailable.success ? "DB connection is available." : "DB connection failed.");
}

initDB();

const appPort = config.get("app.port") || process.env.DEFAULT_APP_PORT;
app.listen(appPort, async () => {
    console.log(`Server is listening on port ${appPort}`);
})
