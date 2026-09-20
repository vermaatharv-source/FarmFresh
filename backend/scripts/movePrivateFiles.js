// One-time migration: KYC documents uploaded before this version were saved in
// the public uploads/ folder. This moves them to private_uploads/ and updates the
// paths stored on each FPO. Safe to run more than once.
//
// Usage (from backend/):  node scripts/movePrivateFiles.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Fpo = require('../models/Fpo');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'uploads');
const PRIVATE_DIR = path.join(ROOT, 'private_uploads');

(async () => {
  try {
    fs.mkdirSync(PRIVATE_DIR, { recursive: true });
    await mongoose.connect(process.env.MONGO_URI);
    let moved = 0;
    let missing = 0;

    for await (const fpo of Fpo.find({ 'kycDocuments.0': { $exists: true } })) {
      const updated = [];
      for (const stored of fpo.kycDocuments) {
        const name = path.basename(String(stored).replace(/\\/g, '/'));
        const from = path.join(PUBLIC_DIR, name);
        const to = path.join(PRIVATE_DIR, name);
        if (fs.existsSync(from)) {
          fs.renameSync(from, to);
          moved += 1;
        } else if (!fs.existsSync(to)) {
          missing += 1;
        }
        updated.push(`private_uploads/${name}`);
      }
      fpo.kycDocuments = updated;
      await fpo.save();
    }

    console.log(`Moved ${moved} KYC document(s) to private storage. ${missing} referenced file(s) were not found on disk.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
