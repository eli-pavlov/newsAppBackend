const fs = require('fs/promises');
const { envVar } = require('../services/env');
const storage = require('../services/storage');

getMoviesFolder = function (subFolder = null) {
  const moviesFolder = envVar('MOVIES_FOLDER');
  return `${moviesFolder}/${subFolder ? subFolder + '/' : ''}`;
}

createUserMoviesFolder = async function (userId) {
  const folderPath = getMoviesFolder(userId);
  if (typeof storage.createFolder === 'function') {
    await storage.createFolder({ folderPath });
  }
}

// Disk-mode helper (used only if storage.getFolderContent exists)
getFolderMoviesList = async function (subFolder = null) {
  try {
    if (typeof storage.getFolderContent !== 'function') {
      // Not supported (e.g., S3). Return empty; S3 path handled in getMoviesList().
      return [];
    }

    const moviesFolderPath = getMoviesFolder(subFolder);
    const folderContent = await storage.getFolderContent({ folderPath: moviesFolderPath });

    let files = [];
    const validExt = (envVar("MOVIES_EXT") || '').split(",").map(s => s.trim()).filter(Boolean);

    if (folderContent.success) {
      folderContent.files.forEach(f => {
        const fileName = f.split('/').pop();
        const fileExt = fileName.includes('.') ? fileName.split('.').pop() : '';

        if (!fileExt || (validExt.length && !validExt.includes(fileExt))) return;

        files.push({
          name: fileName,
          url: storage.movieFilePublicUrl ? storage.movieFilePublicUrl(f, subFolder) : f,
          subFolder,
          deletable: (subFolder !== null)
        });
      });
    }

    return files;
  } catch (e) {
    console.log(e.message);
    return [];
  }
}

// Unified listing that works for both DISK and S3
getMoviesList = async function (userId) {
  if (typeof storage.getMoviesList === 'function') {
    // S3 path (provided by storage_aws_s3.js)
    return await storage.getMoviesList(userId);
  }
  // Disk path (backward compatible)
  const commonMovies = await getFolderMoviesList(null);
  const userMovies = await getFolderMoviesList(userId);
  return [...commonMovies, ...userMovies];
}

deleteMovieFile = async function (fileName, subFolder) {
  try {
    const filePath = getMoviesFolder(subFolder) + fileName;

    if (typeof storage.deleteFile === 'function') {
      await storage.deleteFile({ filePath });
      return { success: true };
    }
    // In S3 mode deletions are handled via presigned flow (this function is unused).
    return { success: false, message: 'deleteFile not supported for current storage type' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

module.exports = {
  getMoviesFolder,
  createUserMoviesFolder,
  getMoviesList,
  deleteMovieFile
}
