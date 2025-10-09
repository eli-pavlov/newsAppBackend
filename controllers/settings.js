// newsAppBackend/controllers/settings.js
const { db } = require('../services/db');
const { getMoviesList } = require('../services/movies'); // This service will now query the DB

class settingsController {
    constructor() {}

    static async getSettingsFromDB(user) {
        try {
            // 1. Get user-specific settings (title, theme, etc.)
            const settingsResult = await db.getSettings(user);

            // 2. Get the list of movies for the user from the database
            const moviesResult = await getMoviesList(user);

            if (settingsResult.success) {
                // Combine settings and the movie list
                settingsResult.data.movies = moviesResult.success ? moviesResult.data : [];
                return settingsResult;
            } else {
                // If no settings exist, create a default structure
                const defaultSettings = {
                    success: true,
                    data: {
                        // ... your default settings structure
                        movies: moviesResult.success ? moviesResult.data : [],
                    }
                };
                return defaultSettings;
            }
        } catch (e) {
            return { success: false, message: e.message };
        }
    }

    async getSettings(req, res) {
        const user = req.user ?? null;
        const result = await settingsController.getSettingsFromDB(user);

        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(500).json(result);
        }
    }

    async getUserSettings(req, res) {
        const user = req.body;
        const result = await settingsController.getSettingsFromDB(user);

        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(500).json(result);
        }
    }
    
    async saveSettings(req, res) {
        try {
            const data = req.body;
            
            // Separate movies from other settings before saving
            const moviesData = data.movies;
            delete data.movies;

            // Save the core settings
            const settingsSaveResult = await db.saveSettings(data, req.user ?? null);
            if (!settingsSaveResult.success) {
                 return res.status(500).json(settingsSaveResult);
            }
            
            // Save the updated state of movies (e.g., 'active' or 'times' properties)
            const moviesUpdateResult = await db.updateMovies(moviesData, req.user ?? null);
            if (!moviesUpdateResult.success) {
                return res.status(500).json(moviesUpdateResult);
            }

            res.status(200).json({ success: true, message: "Settings saved." });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    }
}

module.exports = new settingsController();