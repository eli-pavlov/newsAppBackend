// services/storage.js
// Minimal, robust loader that accepts either class constructors OR plain objects.
// Also normalizes STORAGE_TYPE so values like AWS_S3 / aws_s3 / S3 / DISK all work.

let storageType = String(process.env.STORAGE_TYPE || "").trim().toLowerCase().replace(/-/g, "_");

let mod;
if (storageType === "disk") {
  mod = require("./storage_disk");
} else if (storageType === "aws_s3" || storageType === "aws" || storageType === "s3") {
  mod = require("./storage_aws_s3");
} else {
  mod = require("./storage_base");
}

let storage;
if (typeof mod === "function") {
  // module exports a class (or a function returning an instance)
  try {
    storage = new mod();
  } catch {
    storage = mod();
  }
} else {
  // module exports a ready-to-use object (like storage_aws_s3)
  storage = mod;
}

module.exports = storage;
