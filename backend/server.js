const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const { waf } = require('./middleware/waf');
const { registerRouteIdValidators } = require('./middleware/idValidation');
const { authLimiter, apiLimiter, writeLimiter } = require('./middleware/rateLimiters');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

// ---- Startup safety checks -------------------------------------------------
const fatal = (msg) => {
  console.error(`FATAL: ${msg}`);
  process.exit(1);
};
if (!process.env.MONGO_URI) fatal('MONGO_URI is not set.');
const jwtSecret = process.env.JWT_SECRET || '';
if (!jwtSecret) fatal('JWT_SECRET is not set.');
if (jwtSecret.length < 32 || /change|your|secret|password|example|test/i.test(jwtSecret)) {
  const msg = 'JWT_SECRET is weak or looks like a placeholder. Use 64+ random characters.';
  if (isProd) fatal(msg);
  console.warn(`[security] ${msg}`);
}
if (!/^[0-9a-f]{64}$/i.test(process.env.BANK_ENCRYPTION_KEY || '')) {
  const msg = 'BANK_ENCRYPTION_KEY must be 64 hex characters (used to encrypt bank account numbers).';
  if (isProd) fatal(msg);
  console.warn(`[security] ${msg}`);
}

// multer's diskStorage writes here (see middleware/upload.js). Product and
// grading photos live in uploads/ (public). KYC documents and import sheets
// live in private_uploads/ and are never served statically.
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const privateDir = path.join(__dirname, 'private_uploads');
if (!fs.existsSync(privateDir)) fs.mkdirSync(privateDir, { recursive: true });

const app = express();
app.disable('x-powered-by');

// Only enable when running behind a reverse proxy (Render, Nginx, ...), so
// rate limiting sees the real client IP. e.g. TRUST_PROXY=1
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY === 'true');
}

const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');
const fpoRoutes = require('./routes/fpoRoutes');
const listingRoutes = require('./routes/listingRoutes');
const fpoOrderRoutes = require('./routes/fpoOrderRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const gradePriceRoutes = require('./routes/gradePriceRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const securityRoutes = require('./routes/securityRoutes');

// Import eNAM sync service functions
const { syncAgmarknetPrices, initPriceSyncScheduler } = require('./services/enamSyncService');

// Security headers. Product photos are loaded from a different origin (the
// frontend), so cross-origin resource loading must stay allowed.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS: set CORS_ORIGIN=https://your-frontend.example (comma separated for several).
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
if (allowedOrigins.length) {
  app.use(
    cors({
      origin: (origin, cb) =>
        !origin || allowedOrigins.includes(origin)
          ? cb(null, true)
          : cb(Object.assign(new Error('Origin not allowed by CORS'), { status: 403 })),
    })
  );
} else {
  if (isProd) console.warn('[security] CORS_ORIGIN is not set: any website can call this API.');
  app.use(cors());
}

app.use(express.json({ limit: '1mb' }));

// WAF runs after JSON parsing so it can inspect both query strings and bodies.
app.use(waf);
// Validate ObjectId route parameters after Express matches the route.
registerRouteIdValidators(app);

// Rate limits: global API protection plus a tighter write-request budget.
app.use('/api', apiLimiter);
app.use('/api', writeLimiter);

// Public files: product / grading images only. Anything else (and any legacy
// document left in this folder) is refused. KYC documents are served through
// authenticated endpoints, see controllers/kycController.js.
const IMAGE_FILE = /\.(jpe?g|png|webp|avif|gif)$/i;
app.use(
  '/uploads',
  (req, res, next) => (IMAGE_FILE.test(req.path) ? next() : res.status(404).json({ message: 'Not found' })),
  express.static(uploadsDir, { index: false, dotfiles: 'deny' })
);

// API Route mounts
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes); // coupon validation + unified cart checkout (FPO listings only)
app.use('/api/fpo', fpoRoutes);
app.use('/api/listings', listingRoutes); // FPO product listings, sourced from Inventory
app.use('/api/fpo-orders', fpoOrderRoutes); // consumer orders against FPO listings
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes); // sales/farmer-performance/monthly/settlement/payout CSV (FPO-managed farmers)
app.use('/api/grade-prices', gradePriceRoutes); // per-crop grade-based pricing configs used by batch grading
app.use('/api/reviews', reviewRoutes); // Product Reviews & Ratings
app.use('/api/subscriptions', subscriptionRoutes); // Recurring Subscriptions (Subscribe & Save)
app.use('/api/security', securityRoutes); // Admin-only audit blockchain verification

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ service: 'FarmFresh API', status: 'ok' });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'farmfresh-api' });
});

// Readiness endpoint for Nginx / cloud load balancers. Liveness (/health)
// stays 200 while the process is alive; readiness requires MongoDB.
app.get('/ready', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    database: ready ? 'connected' : 'disconnected',
    service: 'farmfresh-api',
  });
});

// Fallback for undefined 404 routes
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found` });
});

// Global error handler: turns any thrown / forwarded error into a JSON message.
// In production, server-side (5xx) details are hidden from the client.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (maximum 5 MB).' : `File upload error: ${err.message}`;
    return res.status(400).json({ message });
  }
  const status = err.status || 500;
  if (status >= 500) console.error('Unhandled error:', err);
  res.status(status).json({
    message: status >= 500 && isProd ? 'Internal Server Error' : err.message || 'Internal Server Error',
  });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected successfully');

    // 1. Automatically run eNAM market price sync immediately on startup
    syncAgmarknetPrices().catch((err) => console.error('Startup eNAM sync error:', err.message));

    // 2. Start automated daily eNAM market price sync cron scheduler (runs daily at 1:00 AM)
    initPriceSyncScheduler();
  })
  .catch((err) => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const shutdown = async (signal) => {
  console.log(`[shutdown] ${signal} received`);
  server.close(async () => {
    try { await mongoose.connection.close(false); } catch (_) {}
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));