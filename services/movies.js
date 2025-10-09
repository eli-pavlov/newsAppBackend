// newsAppBackend/services/movies.js
const { db } = require('./db');
const { getUserId } = require('./user');

/**
 * Retrieves the list of movie files for a user from the database.
 */
async function getMoviesList(user) {
    const userId = getUserId(user);
    // Add logic to get shared/global movies if 'user' is null or as needed
    return await db.getFilesForUser(userId);
}

// The deleteMovieFile logic is now handled inside the files controller
// to keep S3 and DB operations together for atomicity.

module.exports = {
    getMoviesList
};