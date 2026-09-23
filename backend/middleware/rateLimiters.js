const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const standardMessage = { message: 'Too many requests. Please slow down and try again later.' };

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  message: { message: 'Too many authentication attempts. Please try again in 15 minutes.' },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  message: standardMessage,
});

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  skip: (req) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method),
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  message: { message: 'Too many write requests. Please slow down.' },
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  message: { message: 'Too many upload requests. Please try again later.' },
});

// Tighter budget for review helpful-votes to prevent vote spam.
const voteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  message: { message: 'Too many votes. Please try again later.' },
});

module.exports = { authLimiter, apiLimiter, writeLimiter, uploadLimiter, voteLimiter };
