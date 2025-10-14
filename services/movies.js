const fs = require('fs/promises');
const { envVar } = require('../services/env');
const storage = require('../services/storage');

getMoviesFolder = function (subFolder = null) {
  const moviesFolder = envVar('MOVIES_FOLDER');
  return `${moviesFolder}/${subFolder ? subFolder + '/' : ''}`;
}

createUserMoviesFolder = async function (userId) {
  const folderPath = getMoviesFolder(userId);

  // In S3 mode, there may be no "create folder" concept; call only if implemented
  if (typeof storage.createFolder === 'function') {
    await storage.createFolder({ folderPath });
  }
}

// Disk-mode implementation (used only if storage.getFolderContent exists)
getFolderMoviesList = async function (subFolder = null) {
  try {
    if (typeof storage.getFolderContent !== 'function') {
      // Not supported (e.g., S3). Return empty here; S3 path handled in getMoviesList().
      return [];
    }

    const moviesFolderPath = getMoviesFolder(subFolder);
    const folderContent = await storage.getFolderContent({ folderPath: moviesFolderPath });

    let files = [];
    const validExt = (envVar("MOVIES_EXT") || '').split(",").map(s => s.trim()).filter(Boolean);

    if (folderContent.success) {
      folderContent.files.forEach(f => {
        const fileName = f.split('/').pop();  // get last path segment
        const fileExt = (fileName.includes('.') ? fileName.split('.').pop() : '');

        if (fileExt && (validExt.length === 0 || validExt.includes(fileExt))) {
          files.push({
            name: fileName,
            url: storage.movieFilePublicUrl ? storage.movieFilePublicUrl(f, subFolder) : f,
            subFolder: subFolder,
            deletable: (subFolder !== null)
          });
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

// Unified listing that works for both DISK and S3
getMoviesList = async function (userId) {
  // If the active storage exposes a native listing (S3), use it
  if (typeof storage.getMoviesList === 'function') {
    // S3 path: return what storage_aws_s3 provides (already has name/url/subFolder/deletable)
    return await storage.getMoviesList(userId);
  }

  // Disk path (backward compatible): merge common + user folders
  const commonMovies = await getFolderMoviesList(null);
  const userMovies = await getFolderMoviesList(userId);
  return [...commonMovies, ...userMovies];
}

deleteMovieFile = async function (fileName, subFolder) {
  try {
    // Legacy / disk path
    const filePath = getMoviesFolder(subFolder) + fileName;

    if (typeof storage.deleteFile === 'function') {
      await storage.deleteFile({ filePath });
      return { success: true };
    }

    // In S3 mode deletions use presigned flow via controllers/files.js; this function is then unused.
    return { success: false, message: 'deleteFile not supported for current storage type' };
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
