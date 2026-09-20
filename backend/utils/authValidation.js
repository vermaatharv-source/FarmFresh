const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Always a lower-cased, trimmed string (or '' if the input is not a string).
// Refusing non-strings also blocks NoSQL operator injection such as
// { "email": { "$gt": "" } }.
const normalizeEmail = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

const isValidEmail = (v) => EMAIL_RE.test(v) && v.length <= 254;

// Returns an error message, or null when the password is acceptable.
function passwordProblem(password) {
  if (typeof password !== 'string') return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 128) return 'Password must be at most 128 characters.';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must contain at least one letter and one number.';
  }
  return null;
}

module.exports = { normalizeEmail, isValidEmail, passwordProblem };
