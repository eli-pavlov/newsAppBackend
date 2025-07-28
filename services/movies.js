const fs = require('fs/promises');
const path = require('path');

module.exports.getMoviesList = async function () {
    const moviesFolder = 'movies';
    const folderPath = path.join(__dirname, `../public/${moviesFolder}`);

    try {
        const files = await fs.readdir(folderPath);

        return files;
    }
    catch (e) {
        console.log(e.message);

        return [];
    }
}
