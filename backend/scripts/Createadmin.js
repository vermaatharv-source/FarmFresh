// Creates (or promotes) the authority admin account that can review FPO KYC.
// Usage (from backend/):
//   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='ChangeMe123' node scripts/createAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

(async () => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD before running this script.');
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const hashed = await bcrypt.hash(password, 10);
    let user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      user.role = 'admin';
      user.password = hashed;
      await user.save();
      console.log('Existing user promoted to admin:', user.email);
    } else {
      user = await User.create({
        name: process.env.ADMIN_NAME || 'Authority Admin',
        email,
        password: hashed,
        role: 'admin',
        location: process.env.ADMIN_LOCATION || 'India',
      });
      console.log('Admin created:', user.email);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();