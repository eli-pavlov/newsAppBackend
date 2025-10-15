'use strict';

const { db } = require('../services/db');
const { getMoviesList } = require('../services/movies');
const { getUserId } = require('../services/user');

class settingsController {
  constructor() {}

  // Internal: build response payload safely (never 500)
  async _composeSettingsPayload(req, user) {
    // 1) Load settings row from DB (tolerate failures)
    let settingsData = {};
    try {
      const dbRes = await db.getSettings(user);
      if (dbRes && dbRes.success && dbRes.data) {
        settingsData = dbRes.data;
      }
    } catch (e) {
      // keep empty settingsData
    }

    // 2) Attach server movies from storage (do not break on errors)
    let moviesList = [];
    try {
      const userId = getUserId(user);
      const listRes = await getMoviesList(userId);
      if (listRes && listRes.success) {
        // prefer normalised "content" list
        const content = Array.isArray(listRes.content) ? listRes.content : [];
        if (content.length > 0) {
          moviesList = content.map(i => ({
            name: i.name,
            filePath: i.filePath,
            subFolder: i.subFolder ?? userId ?? null,
            times: i.times ?? 1,
            deletable: i.deletable ?? true,
          }));
        } else if (Array.isArray(listRes.files)) {
          moviesList = listRes.files
            .filter(k => k && !k.endsWith('/'))
            .map(k => ({
              name: String(k).split('/').pop(),
              filePath: k,
              subFolder: userId ?? null,
              times: 1,
              deletable: true,
            }));
        }
      }
    } catch (e) {
      // ignore
    }

    settingsData.movies = Array.isArray(settingsData.movies) && settingsData.movies.length > 0
      ? settingsData.movies
      : moviesList;

    return { success: true, data: settingsData };
  }

  async getSettings(req, res) {
    try {
      const payload = await this._composeSettingsPayload(req, null);
      return res.status(200).json(payload);
    } catch (e) {
      return res.status(200).json({ success: true, data: { movies: [] } }); // never block UI
    }
  }

  async getUserSettings(req, res) {
    try {
      const user = req.body || null;
      const payload = await this._composeSettingsPayload(req, user);
      return res.status(200).json(payload);
    } catch (e) {
      return res.status(200).json({ success: true, data: { movies: [] } });
    }
  }

  async saveSettings(req, res) {
    try {
      const data = req.body;
      const result = await db.saveSettings(data, (req.user ?? null));
      if (result && result.success) {
        return res.status(200).json(result);
      }
      return res.status(500).json(result || { success: false, message: 'Save failed' });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }
}

module.exports = new settingsController();
