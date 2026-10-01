const { Redis } = require('@upstash/redis');
const crypto = require('crypto');

let redisClient = null;

try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    console.log('[Redis] Upstash REST client initialized successfully');
  } else {
    console.warn('[Redis] Upstash Redis credentials not set. Falling back to in-memory mode.');
  }
} catch (err) {
  console.warn('[Redis] Failed to initialize Redis client:', err.message);
  redisClient = null;
}

// Memory fallback cache in case Redis is temporarily unreachable
const inMemoryCache = new Map();

// Generate a compact deterministic hash for the text string
function hashText(text) {
  return crypto.createHash('md5').update(String(text).trim()).digest('hex');
}

function makeKey(sourceLang, targetLang, text) {
  return `tr:${sourceLang || 'en'}:${targetLang}:${hashText(text)}`;
}

/**
 * Get translations for a list of texts from Redis
 * Returns { cachedMap: Map<originalText, translatedText>, missingTexts: string[] }
 */
async function getCachedTranslations(sourceLang, targetLang, texts) {
  const cachedMap = new Map();
  const missingTexts = [];

  if (!texts || !texts.length) {
    return { cachedMap, missingTexts };
  }

  // 1. If Redis is available, perform batch MGET
  if (redisClient) {
    try {
      const keys = texts.map((t) => makeKey(sourceLang, targetLang, t));
      
      // Upstash mget supports array of keys
      const results = await redisClient.mget(...keys);

      texts.forEach((text, index) => {
        const translated = results[index];
        if (translated && typeof translated === 'string' && translated.trim().length > 0) {
          cachedMap.set(text, translated);
          // Also store in in-memory cache for super-fast process access
          inMemoryCache.set(makeKey(sourceLang, targetLang, text), translated);
        } else {
          missingTexts.push(text);
        }
      });

      return { cachedMap, missingTexts };
    } catch (err) {
      console.warn('[Redis] MGET error, checking in-memory cache:', err.message);
    }
  }

  // 2. Fallback to in-memory cache if Redis failed or not configured
  texts.forEach((text) => {
    const key = makeKey(sourceLang, targetLang, text);
    if (inMemoryCache.has(key)) {
      cachedMap.set(text, inMemoryCache.get(key));
    } else {
      missingTexts.push(text);
    }
  });

  return { cachedMap, missingTexts };
}

/**
 * Save new translations to Redis with 90-day TTL
 */
async function setCachedTranslations(sourceLang, targetLang, translationEntries) {
  // translationEntries: Array of [originalText, translatedText]
  if (!translationEntries || !translationEntries.length) return;

  // 1. Update in-memory cache
  translationEntries.forEach(([orig, trans]) => {
    if (orig && trans) {
      inMemoryCache.set(makeKey(sourceLang, targetLang, orig), trans);
    }
  });

  // 2. Update Redis in pipeline/batch
  if (redisClient) {
    try {
      const pipeline = redisClient.pipeline();
      const TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

      translationEntries.forEach(([orig, trans]) => {
        if (orig && trans && trans.trim().length > 0) {
          const key = makeKey(sourceLang, targetLang, orig);
          pipeline.set(key, trans, { ex: TTL_SECONDS });
        }
      });

      await pipeline.exec();
    } catch (err) {
      console.warn('[Redis] Pipeline SET error (non-fatal):', err.message);
    }
  }
}

module.exports = {
  getCachedTranslations,
  setCachedTranslations,
};
