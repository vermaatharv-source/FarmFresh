const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const authRoutes = require('./routes/authRoutes');
const produceRoutes = require('./routes/produceRoutes');
const orderRoutes = require('./routes/orderRoutes');
const fpoRoutes = require('./routes/fpoRoutes');
const listingRoutes = require('./routes/listingRoutes');
const fpoOrderRoutes = require('./routes/fpoOrderRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reportRoutes = require('./routes/reportRoutes');

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// API Route mounts
app.use('/api/auth', authRoutes);
app.use('/api/produce', produceRoutes);
app.use('/api/orders', orderRoutes); // farmer-direct orders (existing, unchanged)
app.use('/api/fpo', fpoRoutes);
app.use('/api/listings', listingRoutes); // NEW: FPO product listings, sourced from Inventory
app.use('/api/fpo-orders', fpoOrderRoutes); // NEW: consumer orders against FPO listings
app.use('/api/notifications', notificationRoutes); // NEW
app.use('/api/reports', reportRoutes); // NEW: sales/farmer-performance/monthly/settlement/payout CSV

// Health check endpoint
app.get('/', (req, res) => {
  res.send('FarmFresh API is running');
});

// Fallback for undefined 404 routes
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found` });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
