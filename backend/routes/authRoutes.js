const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Fpo = require('../models/Fpo'); // 1. Require Fpo model
const { protect } = require('../middleware/authMiddleware');
const { validateFpoDetails } = require('../utils/fpoValidation');
const { normalizeEmail, isValidEmail, passwordProblem } = require('../utils/authValidation');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, password, role, location, phone, acceptTerms } = req.body;
    const email = normalizeEmail(req.body.email);

    // Farmers are not user accounts - FPOs onboard and manage them.
    if (String(role || '').toLowerCase() === 'farmer') {
      return res.status(400).json({
        message: 'Farmer accounts are no longer supported. Farmers are onboarded and managed by their FPO.',
      });
    }

    // Basic input checks (strings only, sensible lengths, strong password).
    if (typeof name !== 'string' || name.trim().length < 2 || name.length > 100) {
      return res.status(400).json({ message: 'Please enter your full name.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }
    const pwProblem = passwordProblem(password);
    if (pwProblem) {
      return res.status(400).json({ message: pwProblem });
    }
    if (typeof location !== 'string' || !location.trim()) {
      return res.status(400).json({ message: 'Location is required.' });
    }
    if (acceptTerms !== true) {
      return res.status(400).json({ message: 'You must accept the Terms and Privacy Notice to create an account.' });
    }

    // Only consumers and FPO admins can self-register. FPO staff are created by
    // their FPO admin, and authority admins are created with scripts/createAdmin.js.
    const signupRole = String(role || '').toLowerCase().replace(/\s+/g, '_');
    if (!['consumer', 'fpo_admin'].includes(signupRole)) {
      return res.status(400).json({ message: 'Invalid account type.' });
    }

    // FPO admins must provide real registration details up front.
    let fpoTop = null;
    let fpoContact = null;
    if (signupRole === 'fpo_admin') {
      const { error, top, contact } = validateFpoDetails(req.body.fpoDetails, { requireCore: true });
      if (error) {
        return res.status(400).json({ message: error });
      }
      if (await Fpo.exists({ registrationNumber: top.registrationNumber })) {
        return res.status(400).json({ message: 'An FPO with this registration number already exists.' });
      }
      fpoTop = top;
      fpoContact = contact;
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      phone: phone || '',
      password: hashedPassword,
      role: signupRole,
      location: location.trim(),
      consentAcceptedAt: new Date(),
    });

    // 2. Automatically create FPO profile document if registering as FPO Admin
    if (user.role === 'fpo_admin') {
      try {
        await Fpo.create({
          ...fpoTop,
          contactDetails: {
            phone: user.phone || '',
            ...fpoContact,
            email: user.email,
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
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        phone: user.phone || '',
        role: user.role, 
        location: user.location,
        addresses: user.addresses || []
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;
    if (!email || typeof password !== 'string' || !password) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Legacy accounts from the removed farmer portal can no longer sign in.
    if (user.role === 'farmer') {
      return res.status(403).json({
        message: 'Farmer accounts are no longer supported. Please contact your FPO.',
      });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        phone: user.phone || '',
        role: user.role, 
        location: user.location,
        addresses: user.addresses || []
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get current user profile & addresses
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update profile details (name, phone, location)
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, phone, location } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (location !== undefined) user.location = location;

    await user.save();
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      location: user.location,
      addresses: user.addresses
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Change Password
router.put('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Please provide both current and new password' });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Address routes
// Get saved addresses
router.get('/addresses', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('addresses');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user.addresses || []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add new address
router.post('/addresses', protect, async (req, res) => {
  try {
    const { label, fullName, phone, streetAddress, landmark, city, state, pincode, isDefault } = req.body;
    if (!fullName || !phone || !streetAddress || !city || !state || !pincode) {
      return res.status(400).json({ message: 'Please fill all required address fields' });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.addresses) user.addresses = [];

    const shouldBeDefault = isDefault || user.addresses.length === 0;
    if (shouldBeDefault) {
      user.addresses.forEach(addr => { addr.isDefault = false; });
    }

    user.addresses.push({
      label: label || 'Home',
      fullName,
      phone,
      streetAddress,
      landmark: landmark || '',
      city,
      state,
      pincode,
      isDefault: shouldBeDefault
    });

    await user.save();
    res.status(201).json(user.addresses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update address
router.put('/addresses/:addressId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const addr = user.addresses.id(req.params.addressId);
    if (!addr) return res.status(404).json({ message: 'Address not found' });

    const { label, fullName, phone, streetAddress, landmark, city, state, pincode, isDefault } = req.body;
    if (label !== undefined) addr.label = label;
    if (fullName !== undefined) addr.fullName = fullName;
    if (phone !== undefined) addr.phone = phone;
    if (streetAddress !== undefined) addr.streetAddress = streetAddress;
    if (landmark !== undefined) addr.landmark = landmark;
    if (city !== undefined) addr.city = city;
    if (state !== undefined) addr.state = state;
    if (pincode !== undefined) addr.pincode = pincode;

    if (isDefault) {
      user.addresses.forEach(a => { a.isDefault = false; });
      addr.isDefault = true;
    }

    await user.save();
    res.json(user.addresses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete address
router.delete('/addresses/:addressId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const targetAddr = user.addresses.id(req.params.addressId);
    if (!targetAddr) return res.status(404).json({ message: 'Address not found' });

    const wasDefault = targetAddr.isDefault;
    user.addresses.pull({ _id: req.params.addressId });

    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();
    res.json(user.addresses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Set default address
router.put('/addresses/:addressId/default', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const addr = user.addresses.id(req.params.addressId);
    if (!addr) return res.status(404).json({ message: 'Address not found' });

    user.addresses.forEach(a => { a.isDefault = false; });
    addr.isDefault = true;

    await user.save();
    res.json(user.addresses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;