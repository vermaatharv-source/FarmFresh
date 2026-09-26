/**
 * Canonical-English helpers.
 *
 * Strategy: whatever language the user types in, translate free-text domain
 * fields (crop names, produce types, etc.) to English BEFORE saving.
 * Person names, phones, IDs are never touched.
 *
 * Search/filter then always runs against English stored values.
 * The frontend AutoTranslate layer shows Hindi/Tamil/etc. on the way out.
 */

const { translateBatch } = require('../services/bhashiniService');

const SUPPORTED = new Set([
  'en', 'hi', 'bn', 'mr', 'gu', 'pa', 'ta', 'te', 'kn', 'ml', 'or', 'as', 'ur',
]);

/**
 * Translate a single string (or array of strings) to English.
 * No-op when sourceLang is missing, 'en', or unsupported, or when text is empty.
 */
async function toEnglish(textOrTexts, sourceLang) {
  const lang = (sourceLang || '').toLowerCase().trim();
  if (!lang || lang === 'en' || !SUPPORTED.has(lang)) {
    return textOrTexts;
  }

  const isArray = Array.isArray(textOrTexts);
  const inputs = (isArray ? textOrTexts : [textOrTexts]).map((t) => String(t ?? '').trim());
  const nonEmptyIdx = [];
  const nonEmpty = [];
  inputs.forEach((t, i) => {
    if (t) {
      nonEmptyIdx.push(i);
      nonEmpty.push(t);
    }
  });

  if (nonEmpty.length === 0) return textOrTexts;

  try {
    const translated = await translateBatch(nonEmpty, lang, 'en');
    const out = [...inputs];
    nonEmptyIdx.forEach((idx, j) => {
      out[idx] = translated[j] || inputs[idx];
    });
    return isArray ? out : out[0];
  } catch (err) {
    console.error('[canonicalText] toEnglish failed, keeping original:', err.message);
    return textOrTexts;
  }
}

/**
 * Pick source language from the request body (preferred) or Accept-Language header.
 */
function sourceLangFromReq(req) {
  const fromBody = req.body?.sourceLanguage || req.body?.sourceLang || req.query?.sourceLanguage;
  if (fromBody && typeof fromBody === 'string') return fromBody.toLowerCase().trim();

  const accept = req.headers['accept-language'] || '';
  const primary = accept.split(',')[0]?.split('-')[0]?.trim().toLowerCase();
  if (primary && SUPPORTED.has(primary)) return primary;
  return 'en';
}

module.exports = { toEnglish, sourceLangFromReq, SUPPORTED };