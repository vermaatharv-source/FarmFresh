const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { translateBatch } = require('../services/bhashiniService');
const { getCachedTranslations, setCachedTranslations } = require('../services/redisService');

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

    if (uniqueTexts.length === 0) {
      return res.json({ translations: texts });
    }

    // 1. Check Redis Cache First
    const { cachedMap, missingTexts } = await getCachedTranslations(
      sourceLanguage || 'en',
      targetLanguage,
      uniqueTexts
    );

    console.log(
      `[translate] ${sourceLanguage || 'en'}→${targetLanguage} | ${texts.length} total (${uniqueTexts.length} unique) | Redis HIT: ${cachedMap.size} | Bhashini FETCH: ${missingTexts.length} | user=${req.user?._id || req.user?.id || '?'}`
    );

    // 2. If there are missing strings, fetch ONLY those from Bhashini
    if (missingTexts.length > 0) {
      try {
        const bhashiniTranslations = await translateBatch(
          missingTexts,
          sourceLanguage || 'en',
          targetLanguage
        );

        const newEntries = [];
        missingTexts.forEach((text, i) => {
          const trans = bhashiniTranslations[i] || text;
          cachedMap.set(text, trans);
          newEntries.push([text, trans]);
        });

        // 3. Save new translations to Redis in the background (fire and forget)
        setCachedTranslations(sourceLanguage || 'en', targetLanguage, newEntries).catch((e) =>
          console.warn('[Redis] Async write error:', e.message)
        );
      } catch (bhashiniErr) {
        console.warn(`[translate] Bhashini call partially failed:`, bhashiniErr.message);
        // If Bhashini fails, fallback missing items to their original English text so user doesn't crash
        missingTexts.forEach((text) => {
          if (!cachedMap.has(text)) cachedMap.set(text, text);
        });
      }
    }

    // 4. Construct final translations array matching the original order
    const translations = texts.map((t) => {
      const key = String(t ?? '');
      return cachedMap.has(key) ? cachedMap.get(key) : t;
    });

    console.log(`[translate] completed in ${Date.now() - started}ms`);
    res.json({ translations, cachedCount: cachedMap.size, fetchedCount: missingTexts.length });
  } catch (err) {
    console.error(`[translate] FAILED in ${Date.now() - started}ms:`, err.message);
    res.status(err.status || 500).json({ message: err.message });
  }
});

module.exports = router;