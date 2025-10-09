const fs = require('fs/promises');
const { envVar } = require('../services/env');
const storage = require('../services/storage');

getMoviesFolder = function (subFolder = null) {
    const moviesFolder = envVar('MOVIES_FOLDER');

    return `${moviesFolder}/${subFolder ? subFolder + '/' : ''}`;
}

createUserMoviesFolder = async function (userId) {
    const folderPath = getMoviesFolder(userId);

    await storage.createFolder({ folderPath: folderPath });
}

getFolderMoviesList = async function (subFolder = null) {
    try {
        const moviesFolderPath = getMoviesFolder(subFolder);

        const folderContent = await storage.getFolderContent({ folderPath: moviesFolderPath });

        let files = []
        const validExt = envVar("MOVIES_EXT").split(",");

        if (folderContent.success) {
            folderContent.files.forEach(f => {
                const fileName = f.split('/').pop();  // get the last splited item
                const fileExt = fileName.split('.').pop();

                if (fileName !== fileExt) {
                    if (validExt.includes(fileExt))
                        files.push(
                            {
                                name: fileName,
                                url: storage.movieFilePublicUrl(f, subFolder),
                                subFolder: subFolder,
                                deletable: (subFolder !== null)
                            }
                        );
                }
            })
        }

        return files;
    }
    catch (e) {
        console.log(e.message);

        return [];
    }
}

getMoviesList = async function (userId) {
    let commonMovies = await this.getFolderMoviesList();

    let userMovies = await getFolderMoviesList(userId);

    return [...commonMovies, ...userMovies];
}

deleteMovieFile = async function (fileName, subFolder) {
    try {
        const filePath = getMoviesFolder(subFolder) + fileName;

        await storage.deleteFile({filePath: filePath});

        return { success: true };
    }
    catch (e) {
        return { success: false, message: e.message };
    }
}

async function insertMovieToDB(movieData) {  // New function
    try {
        // Insert to settings.movies via DB (e.g., append to JSON field)
        // For simplicity, fetch settings, append, save
        const userId = movieData.userId;
        const settings = await db.getSettings(userId);
        if (settings.success) {
            settings.data.movies.push(movieData);
            const saveResult = await db.saveSettings(settings.data, userId);
            return saveResult;
        } else {
            return { success: false, message: 'Failed to get settings for insert.' };
        }
    } catch (e) {
        return { success: false, message: e.message };
    }
}


module.exports = { getMoviesList, deleteMovieFile, insertMovieToDB };
