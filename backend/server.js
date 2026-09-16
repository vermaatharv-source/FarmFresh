const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

dotenv.config();

// multer's diskStorage writes here (see middleware/upload.js); if it's missing,
// every file upload (Excel/CSV import, KYC docs, grading images) fails with a
// raw, unhandled ENOENT that Express turns into a blank 500. Ensure it exists
// once at boot instead of relying on it having been created manually.
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();
const authRoutes = require('./routes/authRoutes');
const produceRoutes = require('./routes/produceRoutes');
const orderRoutes = require('./routes/orderRoutes');
const fpoRoutes = require('./routes/fpoRoutes');
const listingRoutes = require('./routes/listingRoutes');
const fpoOrderRoutes = require('./routes/fpoOrderRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const gradePriceRoutes = require('./routes/gradePriceRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// API Route mounts
app.use('/api/auth', authRoutes);
app.use('/api/produce', produceRoutes);
app.use('/api/orders', orderRoutes); // farmer-direct orders (existing, unchanged)
app.use('/api/fpo', fpoRoutes);
app.use('/api/listings', listingRoutes); // NEW: FPO product listings, sourced from Inventory
app.use('/api/fpo-orders', fpoOrderRoutes); // NEW: consumer orders against FPO listings
app.use('/api/notifications', notificationRoutes); // NEW
app.use('/api/reports', reportRoutes); // NEW: sales/farmer-performance/monthly/settlement/payout CSV
app.use('/api/grade-prices', gradePriceRoutes); // NEW: per-crop grade-based pricing configs used by batch grading
app.use('/api/reviews', reviewRoutes); // Product Reviews & Ratings
app.use('/api/subscriptions', subscriptionRoutes); // Recurring Subscriptions (Subscribe & Save)

// Health check endpoint
app.get('/', (req, res) => {
  res.send('FarmFresh API is running');
});

// Fallback for undefined 404 routes
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found` });
});

// Global error handler — without this, an error thrown or passed to next()
// anywhere above (multer file-upload failures, a bad file field, an
// uncaught rejection in a route) falls through to Express's default
// handler, which sends a bare "Internal Server Error" with no JSON body.
// That's what showed up as an unexplained 500 on the Excel import endpoint.
// This turns any such error into a message the frontend can actually show.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: `File upload error: ${err.message}` });
  }
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));