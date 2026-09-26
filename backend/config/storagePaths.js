const path = require('path');
const fs = require('fs');

// Single source of truth for where uploaded files live.
//
// On Render's default (ephemeral) filesystem, anything written to disk is
// LOST on every restart, redeploy, or scale event. To fix this without a
// full rewrite to S3/Cloudinary, attach a Render "Persistent Disk" to this
// service (Render dashboard -> your service -> Disks -> Add Disk, e.g.
// mount path /data, 1GB+) and set the environment variable:
//
//   DATA_DIR=/data
//
// If DATA_DIR is not set, this falls back to local folders next to the repo
// (fine for local dev, NOT fine for production on Render).
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..');

const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const PRIVATE_DIR = path.join(DATA_DIR, 'private_uploads');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(PRIVATE_DIR, { recursive: true });

if (!process.env.DATA_DIR && process.env.NODE_ENV === 'production') {
  console.warn(
    '[storage] DATA_DIR is not set. Files are being written to the ephemeral ' +
      'container filesystem and WILL be lost on the next deploy/restart. ' +
      'Attach a Render persistent disk and set DATA_DIR to its mount path.'
  );
}

module.exports = { DATA_DIR, UPLOADS_DIR, PRIVATE_DIR };
