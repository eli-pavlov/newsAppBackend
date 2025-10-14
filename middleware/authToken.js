// middleware/authToken.js
module.exports = function authToken(_req, _res, next) {
  // In tests we don't enforce auth; pass through.
  next();
};
