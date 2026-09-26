import { createContext, useContext, useState, useCallback, useRef } from 'react';
import API from '../api/axios';

const LanguageContext = createContext();

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'bn', label: 'বাংলা (Bengali)' },
  { code: 'mr', label: 'मराठी (Marathi)' },
  { code: 'gu', label: 'ગુજરાતી (Gujarati)' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ (Punjabi)' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
  { code: 'te', label: 'తెలుగు (Telugu)' },
  { code: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
  { code: 'ml', label: 'മലയാളം (Malayalam)' },
  { code: 'or', label: 'ଓଡ଼ିଆ (Odia)' },
  { code: 'as', label: 'অসমীয়া (Assamese)' },
  { code: 'ur', label: 'اردو (Urdu)' },
];

const STORAGE_KEY = 'ff_language';

// The backend caps a single /translate request at 200 strings AND the
// server's JSON body parser rejects anything over 1mb (413 Payload Too
// Large) before that count check even runs. A single AutoTranslate pass
// over a big page (e.g. a dashboard full of tables) can easily collect
// thousands of text nodes in one go, so we split into chunks that respect
// both limits instead of sending everything in one request.
const MAX_BATCH_COUNT = 150; // stay under the backend's 200-string cap
const MAX_BATCH_BYTES = 700_000; // stay safely under the 1mb body limit

function chunkTexts(texts) {
  const chunks = [];
  let current = [];
  let currentBytes = 0;

  for (const t of texts) {
    // Rough JSON-encoded size (quotes, comma, escaping overhead).
    const bytes = t.length * 3 + 8;
    if (current.length > 0 && (current.length >= MAX_BATCH_COUNT || currentBytes + bytes > MAX_BATCH_BYTES)) {
      chunks.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(t);
    currentBytes += bytes;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => localStorage.getItem(STORAGE_KEY) || 'en');

  // In-memory cache for this browser session only: key `${lang}::${text}`.
  // Cleared on reload, so translation is genuinely live/on-demand each
  // session — this cache only avoids re-translating the exact same string
  // twice within one visit (e.g. revisiting a tab, or a repeated "Save" button).
  const cacheRef = useRef(new Map());

  const setLanguage = useCallback((code) => {
    localStorage.setItem(STORAGE_KEY, code);
    setLanguageState(code);
  }, []);

  /**
   * Translates a batch of strings to the current language. Returns them
   * unchanged if language === 'en'. Splits out already-cached strings so
   * only genuinely new text hits the backend/Bhashini.
   */
  const translateBatch = useCallback(
    async (texts) => {
      if (language === 'en' || texts.length === 0) return texts;

      const cache = cacheRef.current;
      const toFetch = [];
      const seen = new Set();

      for (const t of texts) {
        const key = `${language}::${t}`;
        if (!cache.has(key) && !seen.has(t) && t.trim()) {
          toFetch.push(t);
          seen.add(t);
        }
      }

      if (toFetch.length > 0) {
        const chunks = chunkTexts(toFetch);

        // Each chunk is independent, so a failure in one doesn't block the
        // others — we fall back to the original text only for the chunk
        // that actually failed.
        await Promise.all(
          chunks.map(async (chunk) => {
            try {
              const { data } = await API.post('/translate', {
                texts: chunk,
                targetLanguage: language,
              });
              chunk.forEach((t, i) => {
                cache.set(`${language}::${t}`, data.translations[i] ?? t);
              });
            } catch (err) {
              // Translation failure should never break the page — fall back
              // to the original English text for whatever couldn't be
              // translated.
              console.error('[translate] batch failed:', err.message);
              chunk.forEach((t) => cache.set(`${language}::${t}`, t));
            }
          })
        );
      }

      return texts.map((t) => cache.get(`${language}::${t}`) ?? t);
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, translateBatch, languages: LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside a LanguageProvider.');
  return ctx;
}