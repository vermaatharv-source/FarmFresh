// FPO staff never receive Aadhaar or bank fields, even masked. Runs on every
// response of the routers it is mounted on and strips those keys for
// role = fpo_staff. (FPO admins see masked values only.)
const HIDDEN_KEYS = new Set(['aadhaarNumber', 'bankDetails', 'accountNumber']);

const strip = (node) => {
  if (Array.isArray(node)) return node.map(strip);
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (!HIDDEN_KEYS.has(k)) out[k] = strip(v);
    }
    return out;
  }
  return node;
};

module.exports = (req, res, next) => {
  const original = res.json.bind(res);
  res.json = (body) => {
    if (req.user && req.user.role === 'fpo_staff') {
      try {
        body = strip(JSON.parse(JSON.stringify(body)));
      } catch (err) {
        /* leave body untouched if it is not serialisable */
      }
    }
    return original(body);
  };
  next();
};
