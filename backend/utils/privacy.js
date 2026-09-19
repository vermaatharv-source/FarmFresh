// Aadhaar numbers must never be stored or shown in full. This keeps only the
// last 4 digits ("XXXX XXXX 1234"). It is idempotent, so applying it to an
// already-masked value returns the same value.
const maskAadhaar = (v) => {
  if (v === undefined || v === null || v === '') return v;
  const digits = String(v).replace(/\D/g, '');
  if (digits.length < 4) return '';
  return `XXXX XXXX ${digits.slice(-4)}`;
};

module.exports = { maskAadhaar };