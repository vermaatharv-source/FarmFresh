// One-time clean-up for farmers saved BEFORE Aadhaar masking / bank encryption
// existed: reduces Aadhaar to the last 4 digits and encrypts plain-text bank
// account numbers. Safe to run more than once.
//
// Usage (from backend/, with BANK_ENCRYPTION_KEY set in .env):
//   node scripts/protectExistingFarmers.js
require('dotenv').config();
const mongoose = require('mongoose');
const Farmer = require('../models/Farmer');
const { maskAadhaar, encryptBankField } = require('../utils/privacy');

(async () => {
  if (!process.env.BANK_ENCRYPTION_KEY || process.env.BANK_ENCRYPTION_KEY.length !== 64) {
    console.error('Set BANK_ENCRYPTION_KEY (64 hex characters) in backend/.env first.');
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    let scanned = 0;
    let updated = 0;
    // Raw collection access so schema getters/setters do not interfere.
    for await (const doc of Farmer.collection.find({})) {
      scanned += 1;
      const set = {};
      if (doc.aadhaarNumber && doc.aadhaarNumber !== maskAadhaar(doc.aadhaarNumber)) {
        set.aadhaarNumber = maskAadhaar(doc.aadhaarNumber);
      }
      const acct = doc.bankDetails && doc.bankDetails.accountNumber;
      if (acct && !String(acct).startsWith('enc:')) {
        set['bankDetails.accountNumber'] = encryptBankField(String(acct));
      }
      if (Object.keys(set).length) {
        await Farmer.collection.updateOne({ _id: doc._id }, { $set: set });
        updated += 1;
      }
    }
    console.log(`Checked ${scanned} farmers, protected ${updated}.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
