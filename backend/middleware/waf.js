/**
 * FarmFresh lightweight Web Application Firewall.
 *
 * This runs before application routes and blocks common request-layer attacks:
 * NoSQL operator injection, prototype pollution, path traversal, obvious XSS
 * payloads and excessively large query/body values.
 *
 * It is an application WAF layer, not a replacement for Cloudflare/AWS WAF.
 */
const MAX_QUERY_KEYS = 50;
const MAX_STRING = 10000;

const DANGEROUS_KEYS = new Set([
  '__proto__', 'prototype', 'constructor',
]);

const NO_SQL_OPERATOR = /^\$(?:where|regex|function|accumulator|expr|jsonSchema|gt|gte|lt|lte|ne|in|nin|or|and|nor|not|exists|type|mod|all|elemMatch|size|bits|text|search|language|caseSensitive|diacriticSensitive|eq|options)$/i;

const XSS_PATTERNS = [
  /<\s*script\b/i,
  /javascript\s*:/i,
  /<\s*iframe\b/i,
  /<\s*object\b/i,
  /<\s*embed\b/i,
  /on(?:error|load|click|mouseover|focus|submit|change)\s*=/i,
  /<\s*svg\b[^>]*\bon/i,
];

const TRAVERSAL_PATTERNS = [
  /\.\.[/\\]/,
  /%2e%2e(?:%2f|%5c)/i,
  /%252e%252e/i,
];

function inspect(value, depth = 0) {
  if (depth > 8) throw Object.assign(new Error('Request nesting is too deep.'), { status: 400 });

  if (typeof value === 'string') {
    if (value.length > MAX_STRING) throw Object.assign(new Error('Request field is too large.'), { status: 413 });
    for (const p of XSS_PATTERNS) {
      if (p.test(value)) throw Object.assign(new Error('Request blocked by security policy.'), { status: 403 });
    }
    for (const p of TRAVERSAL_PATTERNS) {
      if (p.test(value)) throw Object.assign(new Error('Request blocked by security policy.'), { status: 403 });
    }
    return;
  }

  if (Array.isArray(value)) {
    if (value.length > 200) throw Object.assign(new Error('Request array is too large.'), { status: 413 });
    value.forEach((v) => inspect(v, depth + 1));
    return;
  }

  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length > MAX_QUERY_KEYS) throw Object.assign(new Error('Too many request fields.'), { status: 413 });

    for (const key of keys) {
      if (DANGEROUS_KEYS.has(key) || NO_SQL_OPERATOR.test(key)) {
        throw Object.assign(new Error('Request blocked by security policy.'), { status: 403 });
      }
      inspect(value[key], depth + 1);
    }
  }
}

function waf(req, res, next) {
  try {
    // Reject path traversal before Express static/API routing.
    const rawUrl = String(req.originalUrl || '');
    if (TRAVERSAL_PATTERNS.some((p) => p.test(rawUrl))) {
      return res.status(403).json({ message: 'Request blocked by security policy.' });
    }

    // Query/body inspection happens after express.json/urlencoded parsing.
    inspect(req.query);
    inspect(req.body);
    // Route params may already be set for nested routers in some setups;
    // inspecting them is cheap and closes a common bypass path.
    if (req.params && typeof req.params === 'object') {
      inspect(req.params);
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { waf };
