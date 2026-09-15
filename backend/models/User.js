const mongoose = require('mongoose');

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
  password: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String, 
    required: true,
    set: (v) => v.toLowerCase().replace(/\s+/g, '_'), // Automatically formats "FPO Admin" to "fpo_admin"
    enum: ['farmer', 'consumer', 'admin', 'fpo_admin', 'fpo_staff']
  },
  location: { 
    type: String, 
    required: true,
    trim: true 
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);