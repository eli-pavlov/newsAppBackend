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
                const fileName = af.split('/').pop();  // get the last splited item
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

/**
 * Normalize client-provided file identifier (URL/path/name) to an S3 key
 * relative to the movies folder.
 */
function normalizeKey(input, moviesFolder) {
    try {
        let key = String(input || '').trim();

        // If it's a full URL, take the path
        if (/^https?:\/\//i.test(key)) {
            try {
                const u = new URL(key);
                key = u.pathname || key;
            } catch (_) {}
        }

        // Remove leading slash and decode percent-encoding
        key = key.replace(/^\/+/, '');
        try { key = decodeURIComponent(key); } catch (_) {}

        // Drop leading 'uploads/' if present
        if (key.toLowerCase().startsWith('uploads/')) {
            key = key.slice('uploads/'.length);
        }

        // If key already contains the moviesFolder, cut everything up to and including it
        const mf = String(moviesFolder || '').replace(/^\/+|\/+$/g, '');
        if (mf) {
            const pos = key.toLowerCase().indexOf((mf + '/').toLowerCase());
            if (pos >= 0) {
                key = key.slice(pos + mf.length + 1);
            }
        }

        // Final cleanup
        return key.replace(/^\/+/, '');
    } catch (e) {
        return String(input || '').trim();
    }
}

deleteMovieFile = async function (fileName, subFolder) {
    try {
        const moviesFolder = getMoviesFolder(subFolder);
        const rel = normalizeKey(fileName, moviesFolder);
        const filePath = `${moviesFolder}/${rel}`.replace(/\+/g, '/');

        await storage.deleteFile({ filePath });

        return { success: true };
    }
    catch (e) {
        return { success: false, message: e.message };
    }
}

module.exports = {
    getMoviesFolder,
    createUserMoviesFolder,
    getMoviesList,
    deleteMovieFile
}
