const { db } = require('../services/db');
const { getMoviesList } = require('../services/movies');
const { getUserId } = require('../services/user');

/** derive filename from a URL or path (tolerant) */
function basenameFromUrl(u) {
  try {
    if (!u) return null;
    const path = String(u).split('?')[0];
    const parts = path.split('/');
    const last = parts.pop() || parts.pop();
    return last || null;
  } catch {
    return null;
  }
}

/** core merge: saved settings + live server listing (S3/disk) */
async function getSettingsFromDB(req, user) {
  try {
    const result = await db.getSettings(user);

    const userId = getUserId(user);
    const serverMoviesList = await getMoviesList(userId);

    // Index live items by name for quick lookups
    const serverByName = {};
    for (const it of (serverMoviesList || [])) {
      if (!it || !it.name) continue;
      serverByName[it.name] = {
        url: it.url,
        subFolder: it.subFolder ?? null,
        deletable: !!it.deletable,
      };
    }

    // No saved settings? return the live list in canonical shape
    if (!result?.success || !result?.data) {
      const folderFilesList = (serverMoviesList || []).map(f => ({
        file_name: f.name,
        url: f.url,
        deletable: !!f.deletable,
        subFolder: f.subFolder ?? null,
      }));
      return { success: true, data: { movies: folderFilesList } };
    }

    // Merge saved + live
    const saved = Array.isArray(result.data.movies) ? result.data.movies : [];
    const savedNames = new Set();
    const finalMovies = [];

    for (const item of saved) {
      if (!item) continue;

      // canonical name
      let name = item.file_name;
      if (!name && item.url) name = basenameFromUrl(item.url);
      if (!name) continue;

      savedNames.add(name);

      const live = serverByName[name];
      if (live) {
        finalMovies.push({
          file_name: name,
          url: live.url,
          subFolder: live.subFolder,
          deletable: live.deletable,
        });
      } else {
        // legacy URL-only item: keep it so the UI still shows it
        finalMovies.push({
          file_name: name,
          url: item.url || '',
          subFolder: item.subFolder ?? null,
          deletable: !!item.subFolder,
        });
      }
    }

    // add newly discovered files not yet in DB
    for (const it of (serverMoviesList || [])) {
      if (!it || !it.name) continue;
      if (!savedNames.has(it.name)) {
        finalMovies.push({
          file_name: it.name,
          url: it.url,
          subFolder: it.subFolder ?? null,
          deletable: !!it.deletable,
        });
      }
    }

    result.data.movies = finalMovies;
    return result;
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/** GET /settings/get */
async function get(req, res) {
  try {
    const result = await getSettingsFromDB(req, (req.user ?? null));
    if (result?.success) return res.status(200).json(result);
    return res.status(500).json(result);
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
}

/** POST /settings/user  (admin fetch for a specific user) */
async function user(req, res) {
  try {
    const result = await getSettingsFromDB(req, req.body?.user ?? null);
    if (result?.success) return res.status(200).json(result);
    return res.status(500).json(result);
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
}

/** POST /settings/set */
async function set(req, res) {
  try {
    const data = req.body;
    const result = await db.saveSettings(data, (req.user ?? null));
    if (result.success) return res.status(200).json(result);
    return res.status(500).json(result);
  } catch (e) {
    return res.status(500).json({ success: true, message: e.message });
  }
}

module.exports = { get, user, set };
