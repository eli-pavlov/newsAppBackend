// services/env.js
function envVar(name, fallback = undefined) {
  const v = process.env[name];
  if (v === undefined || v === null || v === "") return fallback;
  return v;
}
module.exports = { envVar };
