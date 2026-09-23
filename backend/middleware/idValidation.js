const mongoose = require('mongoose');

// Express route parameters are populated only after a route has matched.
// Therefore this validator is registered with app.param() from server.js,
// rather than mounted as a normal app.use() middleware.
//
// ObjectId params: must be valid 24-hex Mongo ObjectIds.
// Soft-validated params (e.g. batchId): reject empty, oversized, or
// path-traversal-looking values without requiring ObjectId shape, because
// public trace uses human-readable batch codes as well as ObjectIds.
const OBJECT_ID_PARAMS = new Set([
  'id',
  'fpoId',
  'staffId',
  'farmerId',
  'payoutId',
  'addressId',
  'targetId',
]);

// Params that are often custom strings (batch codes) but must still be safe.
const SOFT_ID_PARAMS = new Set(['batchId']);

const SAFE_SOFT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

function validateRouteId(name, value, req, res, next) {
  if (OBJECT_ID_PARAMS.has(name)) {
    if (!mongoose.isValidObjectId(value)) {
      return res.status(400).json({ message: `Invalid ${name}.` });
    }
    return next();
  }

  if (SOFT_ID_PARAMS.has(name)) {
    const str = String(value || '');
    if (!str || str.length > 64 || !SAFE_SOFT_ID.test(str)) {
      return res.status(400).json({ message: `Invalid ${name}.` });
    }
    return next();
  }

  return next();
}

function registerRouteIdValidators(app) {
  for (const name of OBJECT_ID_PARAMS) {
    app.param(name, (req, res, next, value) => validateRouteId(name, value, req, res, next));
  }
  for (const name of SOFT_ID_PARAMS) {
    app.param(name, (req, res, next, value) => validateRouteId(name, value, req, res, next));
  }
}

module.exports = { registerRouteIdValidators, validateRouteId, OBJECT_ID_PARAMS, SOFT_ID_PARAMS };
