const { db } = require('../services/db');
const { getMoviesList } = require('../services/movies');
const { getUserId } = require('../services/user');

/**
 * Merge DB-saved movies with server discovery (S3/disk).
 * Tolerates legacy entries that have only a URL by deriving file_name from the URL.
 */
class settingsController {
  constructor() {}

  static _basenameFromUrl(u) {
    try {
      if (!u) return null;
      // Works for both absolute and relative URLs
      const path = u.split('?')[0]; // strip query if present
      const parts = path.split('/');
      const last = parts.pop() || parts.pop(); // handle trailing slash
      return last || null;
    } catch {
      return null;
    }
  }

  static async getSettingsFromDB(req, user) {
    try {
      const result = await db.getSettings(user);

      // Live server discovery (S3 + disk via services/movies.js)
      const userId = getUserId(user);
      const serverMoviesList = await getMoviesList(userId);

      // Map discovered entries by filename for quick lookup
      const serverByName = {};
      for (const it of (serverMoviesList || [])) {
        if (!it || !it.name) continue;
        serverByName[it.name] = {
          url: it.url,
          subFolder: it.subFolder ?? null,
          deletable: !!it.deletable,
        };
      }

      // No saved settings? Return server list as default shape
      if (!result?.success || !result?.data) {
        const folderFilesList = (serverMoviesList || []).map(f => ({
          file_name: f.name,
          url: f.url,
          deletable: !!f.deletable,
          subFolder: f.subFolder ?? null,
        }));
        return { success: true, data: { movies: folderFilesList } };
      }

      // Saved settings exist — merge carefully
      const saved = Array.isArray(result.data.movies) ? result.data.movies : [];

      // Build a set of names saved in DB (derive from url if file_name missing)
      const savedNames = new Set();
      const finalMovies = [];

      for (const item of saved) {
        if (!item) continue;

        // Derive a canonical filename
        let name = item.file_name;
        if (!name && item.url) {
          name = settingsController._basenameFromUrl(item.url);
        }
        if (!name) {
          // If we truly can't derive a name, skip; nothing to match on
          continue;
        }
        savedNames.add(name);

        // If server confirmed this file, trust server URL/subFolder/deletable
        const s = serverByName[name];
        if (s) {
          finalMovies.push({
            file_name: name,
            url: s.url,
            subFolder: s.subFolder,
            deletable: s.deletable,
          });
        } else {
          // Legacy/unknown location: keep DB URL so UI can still show it
          finalMovies.push({
            file_name: name,
            url: item.url || '',
            subFolder: item.subFolder ?? null,
            deletable: !!item.subFolder, // conservative: deletable only if explicitly user-scoped
          });
        }
      }

      // Add newly discovered files not yet in DB
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

      // Save merged list back into the result so caller returns it
      result.data.movies = finalMovies;
      return result;
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  async get(req, res) {
    try {
      const result = await settingsController.getSettingsFromDB(req, (req.user ?? null));
      if (result?.success) return res.status(200).json(result);
      return res.status(500).json(result);
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  // Admin: get settings for a provided user
  async user(req, res) {
    try {
      const result = await settingsController.getSettingsFromDB(req, req.body?.user ?? null);
      if (result?.success) return res.status(200).json(result);
      return res.status(500).json(result);
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  async set(req, res) {
    try {
      const data = req.body;
      const result = await db.saveSettings(data, (req.user ?? null));
      if (result.success) return res.status(200).json(result);
      return res.status(500).json(result);
    } catch (e) {
      return res.status(500).json({ success: true, message: e.message });
    }
  }
}

module.exports = new settingsController();
