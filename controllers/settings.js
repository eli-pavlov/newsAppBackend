const { db } = require('../services/db');
const { getMoviesList } = require('../services/movies')
// const auth = require("../middleware/auth");

class settingsController {
    constructor() {
    }

    async getSettings(req, res) {
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
                        file_name: f,
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
                    file_name: f,
                    url: `${req.protocol}://${req.get('host')}/assets/movies/${f}`,
                }));

                result.movies = folderFilesList;
                result.message = result.message ?? "Get settings failed.";
                res.status(500).json(result)
            }
        }
        catch (e) {
            res.status(500).json({ success: true, message: e.message })
        }
    }

    async saveSettings(req, res) {
        try {
            const data = req.body;

            const result = await db.saveSettings(data);

            if (result.success)
                res.status(200).json(result)
            else
                res.status(500).json(result)
        }
        catch (e) {
            res.status(500).json({ success: true, message: e.message })
        }
    }
}

module.exports = new settingsController();
