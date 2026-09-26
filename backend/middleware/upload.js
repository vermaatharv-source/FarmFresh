const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { UPLOADS_DIR, PRIVATE_DIR } = require('../config/storagePaths');

// Three upload profiles:
//   uploadImages  - product / grading photos. Stored in UPLOADS_DIR and
//                   publicly viewable (they are shown to consumers).
//   uploadKyc     - KYC documents (PDF / JPG / PNG). Stored in PRIVATE_DIR,
//                   which is NEVER served statically.
//   uploadImport  - farmer import sheets (.xlsx / .csv). They contain Aadhaar
//                   and bank data, so they also go to PRIVATE_DIR and are
//                   deleted right after processing.
//
// UPLOADS_DIR / PRIVATE_DIR resolve under DATA_DIR (see config/storagePaths.js).
// On Render, DATA_DIR must point at a mounted persistent disk or these files
// disappear on every restart/redeploy.
//
// File names are random and the extension comes from the checked MIME type, not
// from whatever the client called the file.
const MB = 1024 * 1024;
const rand = () => crypto.randomBytes(16).toString('hex');
const reject = (message) => {
  const err = new Error(message);
  err.status = 400;
  return err;
};

const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/avif': '.avif' };
const KYC_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'application/pdf': '.pdf' };
const IMPORT_EXT = ['.xlsx', '.csv'];

const storageFor = (destination, extFromMime) =>
  multer.diskStorage({
    destination: (req, file, cb) => cb(null, destination),
    filename: (req, file, cb) => cb(null, rand() + (extFromMime[file.mimetype] || '')),
  });

const uploadImages = multer({
  storage: storageFor(UPLOADS_DIR, IMAGE_TYPES),
  limits: { fileSize: 5 * MB, files: 5 },
  fileFilter: (req, file, cb) =>
    IMAGE_TYPES[file.mimetype] ? cb(null, true) : cb(reject('Only JPG, PNG, WebP or AVIF images are allowed.')),
});

const uploadKyc = multer({
  storage: storageFor(PRIVATE_DIR, KYC_TYPES),
  limits: { fileSize: 5 * MB, files: 5 },
  fileFilter: (req, file, cb) =>
    KYC_TYPES[file.mimetype] ? cb(null, true) : cb(reject('KYC documents must be PDF, JPG or PNG files.')),
});

const uploadImport = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, PRIVATE_DIR),
    filename: (req, file, cb) => cb(null, `import-${rand()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * MB, files: 1 },
  fileFilter: (req, file, cb) =>
    IMPORT_EXT.includes(path.extname(file.originalname).toLowerCase())
      ? cb(null, true)
      : cb(reject('Only .xlsx or .csv files can be imported.')),
});

// The MIME type is declared by the client, so also check the file's first bytes.
const SIGNATURES = {
  pdf: [Buffer.from('%PDF')],
  png: [Buffer.from([0x89, 0x50, 0x4e, 0x47])],
  jpg: [Buffer.from([0xff, 0xd8, 0xff])],
  xlsx: [Buffer.from('PK')],
};

function hasSignature(filePath, kinds) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(8);
    fs.readSync(fd, buf, 0, 8, 0);
    fs.closeSync(fd);
    return kinds.some((k) => SIGNATURES[k].some((sig) => buf.subarray(0, sig.length).equals(sig)));
  } catch (err) {
    return false;
  }
}

module.exports = uploadImages;
module.exports.uploadImages = uploadImages;
module.exports.uploadKyc = uploadKyc;
module.exports.uploadImport = uploadImport;
module.exports.hasSignature = hasSignature;
module.exports.UPLOADS_DIR = UPLOADS_DIR;
module.exports.PRIVATE_DIR = PRIVATE_DIR;
// Kept for any code still importing the old name.
module.exports.PRIVATE_DIR_LEGACY_ALIAS = PRIVATE_DIR;
