import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
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
const TRANSLATION_CACHE_KEY = 'ff_translation_cache_v2';

const MAX_BATCH_COUNT = 150;
const MAX_BATCH_BYTES = 700_000;

// Pre-seeded high-frequency static UI vocabulary for instant 0ms cold loads
const SEED_DICTIONARY = {
  hi: {
    'Overview': 'अवलोकन',
    'FPO Operations': 'एफपीओ संचालन',
    'Farmers': 'किसान',
    'Intake & Grading': 'आवक और ग्रेडिंग',
    'Inventory': 'इन्वेंटरी',
    'Listings': 'लिस्टिंग',
    'Orders': 'ऑर्डर',
    'Payouts': 'भुगतान (पेआउट)',
    'Marketplace Earnings': 'मार्केटप्लेस कमाई',
    'Reports': 'रिपोर्ट',
    'Audit Log': 'ऑडिट लॉग',
    'Profile & KYC': 'प्रोफ़ाइल और केवाईसी',
    'Compliance': 'अनुपालन',
    'Command Center': 'कमांड सेंटर',
    'Cash Flow': 'कैश फ्लो',
    'Active farmers': 'सक्रिय किसान',
    'Pending orders': 'लंबित ऑर्डर',
    'Refresh': 'रिफ्रेश',
    'Save': 'सहेजें',
    'Submit': 'जमा करें',
    'Logout': 'लॉग आउट',
    'Grade A': 'ग्रेड ए',
    'Grade B': 'ग्रेड बी',
    'Grade C': 'ग्रेड सी',
    'Quantity': 'मात्रा',
    'Price': 'मूल्य',
    'Produce': 'उपज',
    'Status': 'स्थिति',
  },
  mr: {
    'Overview': 'आढावा',
    'FPO Operations': 'एफपीओ कामकाज',
    'Farmers': 'शेतकरी',
    'Intake & Grading': 'आवक व प्रतवारी',
    'Inventory': 'साठा (इन्व्हेंटरी)',
    'Listings': 'उत्पादन यादी',
    'Orders': 'ऑर्डर',
    'Payouts': 'शेतकरी पेमेंट',
    'Marketplace Earnings': 'बाजार कमाई',
    'Reports': 'अहवाल',
    'Audit Log': 'ऑडिट नोंद',
    'Profile & KYC': 'प्रोफाइल आणि केवायसी',
    'Command Center': 'कमांड सेंटर',
    'Cash Flow': 'कॅश फ्लो',
    'Active farmers': 'सक्रिय शेतकरी',
    'Pending orders': 'प्रलंबित ऑर्डर',
    'Refresh': 'रिफ्रेश',
    'Save': 'जतन करा',
    'Submit': 'सबमिट करा',
    'Logout': 'लॉगआउट',
    'Grade A': 'ग्रेड अ',
    'Grade B': 'ग्रेड ब',
    'Grade C': 'ग्रेड क',
  },
};

function chunkTexts(texts) {
  const chunks = [];
  let current = [];
  let currentBytes = 0;

  for (const t of texts) {
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

  // Persistent translation cache (loaded from localStorage + seeded with static dictionary)
  const cacheRef = useRef(new Map());
  const isCacheLoaded = useRef(false);

  // Initialize cache from localStorage & seed dictionaries
  useEffect(() => {
    if (isCacheLoaded.current) return;
    const cache = cacheRef.current;

    // 1. Seed static dictionary
    Object.entries(SEED_DICTIONARY).forEach(([lang, words]) => {
      Object.entries(words).forEach(([orig, trans]) => {
        cache.set(`${lang}::${orig}`, trans);
      });
    });

    // 2. Load persistent client cache from localStorage
    try {
      const stored = localStorage.getItem(TRANSLATION_CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed === 'object' && parsed !== null) {
          Object.entries(parsed).forEach(([key, val]) => {
            if (key && val) cache.set(key, val);
          });
        }
      }
    } catch {
      // ignore parsing error
    }

    isCacheLoaded.current = true;
  }, []);

  const persistCacheToStorage = useCallback(() => {
    try {
      const cache = cacheRef.current;
      const obj = {};
      // Cap localStorage cache size to recent 3,000 items to prevent storage quota issues
      let count = 0;
      for (const [key, val] of cache.entries()) {
        if (count > 3000) break;
        obj[key] = val;
        count++;
      }
      localStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(obj));
    } catch {
      // Storage quota exceeded — gracefully fail silently
    }
  }, []);

  const setLanguage = useCallback((code) => {
    localStorage.setItem(STORAGE_KEY, code);
    setLanguageState(code);
  }, []);

  /**
   * Translates a batch of strings. Instant return for cached strings (< 1ms).
   * Only fetches genuinely missing strings from Redis/Bhashini backend.
   */
  const translateBatch = useCallback(
    async (texts) => {
      if (language === 'en' || !texts || texts.length === 0) return texts;

      const cache = cacheRef.current;
      const toFetch = [];
      const seen = new Set();

      for (const t of texts) {
        const key = `${language}::${t}`;
        if (!cache.has(key) && !seen.has(t) && typeof t === 'string' && t.trim()) {
          toFetch.push(t);
          seen.add(t);
        }
      }

      // If all strings are already cached in browser memory, return instantly in 0ms!
      if (toFetch.length > 0) {
        const chunks = chunkTexts(toFetch);
        let hasNewTranslations = false;

        await Promise.all(
          chunks.map(async (chunk) => {
            try {
              const { data } = await API.post('/translate', {
                texts: chunk,
                targetLanguage: language,
              });

              if (data && Array.isArray(data.translations)) {
                chunk.forEach((t, i) => {
                  const trans = data.translations[i] ?? t;
                  cache.set(`${language}::${t}`, trans);
                });
                hasNewTranslations = true;
              }
            } catch (err) {
              console.warn('[translate] fetch fallback to original:', err.message);
              chunk.forEach((t) => cache.set(`${language}::${t}`, t));
            }
          })
        );

        if (hasNewTranslations) {
          persistCacheToStorage();
        }
      }

      return texts.map((t) => cache.get(`${language}::${t}`) ?? t);
    },
    [language, persistCacheToStorage]
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