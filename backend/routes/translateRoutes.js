const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { translateBatch } = require('../services/bhashiniService');

const SUPPORTED_LANGUAGES = new Set([
  'en', 'hi', 'bn', 'mr', 'gu', 'pa', 'ta', 'te', 'kn', 'ml', 'or', 'as', 'ur',
]);

/**
 * POST /api/translate
 * body: { texts: string[], targetLanguage: 'hi', sourceLanguage?: 'en' }
 * → { translations: string[] }
 */
router.post('/', protect, async (req, res) => {
  const started = Date.now();
  try {
    const { texts, targetLanguage, sourceLanguage = 'en' } = req.body;

    if (!Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({ message: '"texts" must be a non-empty array of strings.' });
    }
    if (texts.length > 200) {
      return res.status(400).json({ message: 'Too many strings in one batch (max 200).' });
    }
    if (!SUPPORTED_LANGUAGES.has(targetLanguage)) {
      return res.status(400).json({ message: `Unsupported target language "${targetLanguage}".` });
    }
    if (sourceLanguage && !SUPPORTED_LANGUAGES.has(sourceLanguage)) {
      return res.status(400).json({ message: `Unsupported source language "${sourceLanguage}".` });
    }

    const uniqueTexts = [...new Set(texts.map((t) => String(t ?? '')))].filter((t) => t.trim().length > 0);

    console.log(
      `[translate] ${sourceLanguage || 'en'}→${targetLanguage} | ${texts.length} strings (${uniqueTexts.length} unique) | user=${req.user?._id || req.user?.id || '?'}`
    );

    if (uniqueTexts.length === 0) {
      return res.json({ translations: texts });
    }

    const uniqueTranslations = await translateBatch(uniqueTexts, sourceLanguage || 'en', targetLanguage);
    const map = new Map(uniqueTexts.map((t, i) => [t, uniqueTranslations[i]]));

    const translations = texts.map((t) => {
      const key = String(t ?? '');
      return map.has(key) ? map.get(key) : t;
    });

    console.log(`[translate] ok in ${Date.now() - started}ms`);
    res.json({ translations });
  } catch (err) {
    console.error(`[translate] FAILED in ${Date.now() - started}ms:`, err.message);
    res.status(err.status || 500).json({ message: err.message });
  }
});

module.exports = router;