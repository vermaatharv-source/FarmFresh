const crypto = require('crypto');

// Aadhaar: store / return only last 4 digits
const maskAadhaar = (v) => {
  if (v === undefined || v === null || v === '') return v;
  const digits = String(v).replace(/\D/g, '');
  if (digits.length < 4) return '';
  return `XXXX XXXX ${digits.slice(-4)}`;
};

// Bank account encryption at rest (AES-256-GCM)
// Set BANK_ENCRYPTION_KEY in .env as a 32-byte hex string (64 hex chars).
// Generate once: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
const getKey = () => {
  const hex = process.env.BANK_ENCRYPTION_KEY || '';
  if (/^[0-9a-fA-F]{64}$/.test(hex)) {
    return Buffer.from(hex, 'hex');
  }
  // Never derive from JWT_SECRET — that couples two independent secrets.
  // In production the server already refuses to start without a valid key.
  // Dev-only fallback keeps local demos working; do not rely on it in prod.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('BANK_ENCRYPTION_KEY must be 64 hex characters in production.');
  }
  return crypto.createHash('sha256').update('farmfresh-dev-only-bank-key').digest();
};

// A value that came back from the API already masked ("XXXXXX1234").
const looksMasked = (v) => /^[Xx*\s-]+\d{0,4}$/.test(String(v || '').trim());

// Mongoose setter (needs `this`, so it is a normal function, not an arrow).
// A masked value must never be encrypted as if it were the real number, so it
// keeps whatever is already stored instead.
function encryptBankField(plain) {
  if (plain === undefined || plain === null || plain === '') return plain;
  const str = String(plain);
  // Already encrypted marker
  if (str.startsWith('enc:')) return str;
  if (looksMasked(str)) {
    return this && typeof this.get === 'function'
      ? this.get('bankDetails.accountNumber', null, { getters: false })
      : undefined;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(str, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

const decryptBankField = (stored) => {
  if (stored === undefined || stored === null || stored === '') return stored;
  const str = String(stored);
  if (!str.startsWith('enc:')) return str; // legacy plain text
  try {
    const parts = str.split(':');
    if (parts.length !== 4) return '********';
    const [, ivHex, tagHex, dataHex] = parts;
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    return dec.toString('utf8');
  } catch {
    return '********';
  }
};

/** Mask account number for non-admin display: show last 4 only */
const maskAccountNumber = (v) => {
  if (!v) return v;
  const plain = decryptBankField(v);
  const digits = String(plain).replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `XXXXXX${digits.slice(-4)}`;
};

module.exports = {
  looksMasked,
  maskAadhaar,
  encryptBankField,
  decryptBankField,
  maskAccountNumber,
};
