const REG_TYPES = ['Producer Company', 'Cooperative Society', 'Other'];
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PIN_RE = /^[0-9]{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const str = (v) => (v === undefined || v === null ? undefined : String(v).trim());

/**
 * Validates and normalises FPO registration / profile details.
 * Accepts flat fields or contact fields nested under `contactDetails`.
 * Only fields that are present in the input are returned, so it works for
 * both first-time registration (requireCore = true) and partial profile edits.
 *
 * Returns { error, top, contact } where `top` are Fpo fields and `contact`
 * are contactDetails fields.
 */
function validateFpoDetails(input = {}, { requireCore = false } = {}) {
  const d = input || {};
  const c = d.contactDetails || {};
  const top = {};
  const contact = {};

  const name = str(d.name);
  const registrationNumber = str(d.registrationNumber);
  const registrationType = str(d.registrationType);
  const state = str(d.state ?? c.state);
  const district = str(d.district ?? c.district);

  if (requireCore) {
    if (!name) return { error: 'FPO legal name is required.' };
    if (!registrationType) return { error: 'Registration type is required.' };
    if (!registrationNumber) return { error: 'Registration number is required.' };
    if (!state) return { error: 'State is required.' };
    if (!district) return { error: 'District is required.' };
  }

  if (name !== undefined) {
    if (!name) return { error: 'FPO legal name cannot be empty.' };
    top.name = name;
  }
  if (registrationNumber !== undefined) {
    if (!registrationNumber) return { error: 'Registration number cannot be empty.' };
    top.registrationNumber = registrationNumber;
  }
  if (registrationType !== undefined) {
    if (registrationType && !REG_TYPES.includes(registrationType)) {
      return { error: `Registration type must be one of: ${REG_TYPES.join(', ')}.` };
    }
    top.registrationType = registrationType;
  }

  const pan = str(d.pan);
  if (pan !== undefined) {
    const v = pan.toUpperCase();
    if (v && !PAN_RE.test(v)) return { error: 'PAN must be in the format ABCDE1234F.' };
    top.pan = v;
  }
  const gstin = str(d.gstin);
  if (gstin !== undefined) {
    const v = gstin.toUpperCase();
    if (v && !GSTIN_RE.test(v)) return { error: 'GSTIN must be a valid 15-character GST number.' };
    top.gstin = v;
  }

  for (const k of ['fssaiLicense', 'udyamNumber', 'cbboName', 'schemeName', 'managerName', 'managerContact']) {
    const v = str(d[k]);
    if (v !== undefined) top[k] = v;
  }

  if (d.dateOfIncorporation !== undefined) {
    if (d.dateOfIncorporation === '' || d.dateOfIncorporation === null) {
      top.dateOfIncorporation = null;
    } else {
      const dt = new Date(d.dateOfIncorporation);
      if (Number.isNaN(dt.getTime())) return { error: 'Date of incorporation is not a valid date.' };
      if (dt > new Date()) return { error: 'Date of incorporation cannot be in the future.' };
      top.dateOfIncorporation = dt;
    }
  }

  if (d.shareholderFarmerCount !== undefined) {
    if (d.shareholderFarmerCount === '' || d.shareholderFarmerCount === null) {
      top.shareholderFarmerCount = 0;
    } else {
      const n = Number(d.shareholderFarmerCount);
      if (!Number.isInteger(n) || n < 0) return { error: 'Shareholder farmer count must be a whole number.' };
      top.shareholderFarmerCount = n;
    }
  }

  const pincode = str(d.pincode ?? c.pincode);
  if (pincode !== undefined) {
    if (pincode && !PIN_RE.test(pincode)) return { error: 'Pincode must be 6 digits.' };
    contact.pincode = pincode;
  }
  const email = str(d.email ?? c.email);
  if (email !== undefined) {
    if (email && !EMAIL_RE.test(email)) return { error: 'Contact email is not valid.' };
    if (email) contact.email = email;
  }
  if (state !== undefined) contact.state = state;
  if (district !== undefined) contact.district = district;
  const address = str(d.address ?? c.address);
  if (address !== undefined) contact.address = address;
  const phone = str(d.phone ?? c.phone);
  if (phone !== undefined) contact.phone = phone;

  return { error: null, top, contact };
}

module.exports = { validateFpoDetails, REG_TYPES };