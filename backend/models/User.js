const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  label: { 
    type: String, 
    enum: ['Home', 'Work', 'Other'], 
    default: 'Home' 
  },
  fullName: { 
    type: String, 
    required: true, 
    trim: true 
  },
  phone: { 
    type: String, 
    required: true, 
    trim: true 
  },
  streetAddress: { 
    type: String, 
    required: true, 
    trim: true 
  },
  landmark: { 
    type: String, 
    default: '', 
    trim: true 
  },
  city: { 
    type: String, 
    required: true, 
    trim: true 
  },
  state: { 
    type: String, 
    required: true, 
    trim: true 
  },
  pincode: { 
    type: String, 
    required: true, 
    trim: true 
  },
  isDefault: { 
    type: Boolean, 
    default: false 
  }
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true 
  },
  phone: {
    type: String,
    default: '',
    trim: true
  },
  password: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String, 
    required: true,
    set: (v) => v.toLowerCase().replace(/\s+/g, '_'), // Automatically formats "FPO Admin" to "fpo_admin"
    enum: ['consumer', 'admin', 'fpo_admin', 'fpo_staff'] // farmers are FPO-managed records (see models/Farmer.js), not user accounts
  },
  location: { 
    type: String, 
    required: true, 
    trim: true 
  },
  addresses: [addressSchema]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);