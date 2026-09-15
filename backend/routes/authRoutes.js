const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Fpo = require('../models/Fpo'); // 1. Require Fpo model

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, location } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      location,
    });

    // 2. Automatically create FPO profile document if registering as FPO Admin
    // FIX: wrapped in its own try/catch. If this fails for any reason, we no
    // longer leave the caller with a confusing 500 and an orphaned User doc —
    // we roll the User back and return a clear error instead.
    if (user.role === 'fpo_admin') {
      try {
        await Fpo.create({
          name: `${user.name}'s FPO`,
          registrationNumber: `REG-${Date.now()}`,
          contactDetails: {
            email: user.email,
            phone: '',
            address: '',
          },
          adminUser: user._id,
        });
      } catch (fpoErr) {
        await User.findByIdAndDelete(user._id);
        return res.status(500).json({
          message: 'Failed to create FPO profile during registration. Please try again.',
          error: fpoErr.message,
        });
      }
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, location: user.location },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, location: user.location },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
