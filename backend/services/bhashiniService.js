const axios = require('axios');

/**
 * Bhashini (Digital India / MeitY) translation client.
 *
 * Bhashini's API is a two-step flow, not a single translate call:
 *
 *   1. POST to the ULCA config endpoint with your account-level
 *      userID + ulcaApiKey → it returns a serviceId, a callbackUrl, and a
 *      DIFFERENT model-specific inferenceApiKey (a {name, value} header
 *      pair — the header name itself varies, so don't hardcode
 *      "Authorization").
 *   2. POST to that callbackUrl using the inferenceApiKey header to run
 *      the actual translation.
 *
 * Step 1 is slow (it's a discovery call) and its result is stable for a
 * given source/target language pair, so we cache it in memory per
 * language pair with a TTL rather than repeating it on every request.
 */

const CONFIG_ENDPOINT = 'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline';
const DEFAULT_PIPELINE_ID = '64392f96daac500b55c543cd'; // Bhashini's standard NMT pipeline
const CONFIG_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const configCache = new Map(); // key: `${sourceLang}|${targetLang}` -> { data, expiresAt }

function assertCredentials() {
  if (!process.env.BHASHINI_USER_ID || !process.env.BHASHINI_ULCA_API_KEY) {
    const err = new Error('BHASHINI_USER_ID / BHASHINI_ULCA_API_KEY are not set in .env.');
    err.status = 500;
    throw err;
  }
}

/**
 * Step 1: resolve (and cache) the serviceId + inference endpoint/key for
 * a given source→target language pair.
 */
async function getPipelineConfig(sourceLang, targetLang) {
  const cacheKey = `${sourceLang}|${targetLang}`;
  const cached = configCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  assertCredentials();

  const response = await axios.post(
    CONFIG_ENDPOINT,
    {
      pipelineTasks: [
        {
          taskType: 'translation',
          config: { language: { sourceLanguage: sourceLang, targetLanguage: targetLang } },
        },
      ],
      pipelineRequestConfig: {
        pipelineId: process.env.BHASHINI_PIPELINE_ID || DEFAULT_PIPELINE_ID,
      },
    },
    {
      headers: {
        'Content-Type': 'application/json',
        userID: process.env.BHASHINI_USER_ID,
        ulcaApiKey: process.env.BHASHINI_ULCA_API_KEY,
      },
      timeout: 15_000,
    }
  );

  const data = response.data;
  const serviceId = data?.pipelineResponseConfig?.[0]?.config?.[0]?.serviceId;
  const callbackUrl = data?.pipelineInferenceAPIEndPoint?.callbackUrl;
  const inferenceHeaderName = data?.pipelineInferenceAPIEndPoint?.inferenceApiKey?.name;
  const inferenceHeaderValue = data?.pipelineInferenceAPIEndPoint?.inferenceApiKey?.value;

  if (!serviceId || !callbackUrl || !inferenceHeaderName || !inferenceHeaderValue) {
    const err = new Error(
      `Bhashini did not return a usable pipeline for ${sourceLang}→${targetLang}. This language pair may not be supported by the approved pipeline.`
    );
    err.status = 502;
    throw err;
  }

  const resolved = { serviceId, callbackUrl, inferenceHeaderName, inferenceHeaderValue };
  configCache.set(cacheKey, { data: resolved, expiresAt: Date.now() + CONFIG_CACHE_TTL_MS });
  return resolved;
}

/**
 * Step 2: translate a batch of strings in one inference call.
 * Returns an array of translated strings, same order/length as `texts`.
 */
async function translateBatch(texts, sourceLang, targetLang) {
  if (!texts.length) return [];

  // English → English (or same-language requests) — skip the network call.
  if (sourceLang === targetLang) return texts;

  const { serviceId, callbackUrl, inferenceHeaderName, inferenceHeaderValue } = await getPipelineConfig(
    sourceLang,
    targetLang
  );

  const response = await axios.post(
    callbackUrl,
    {
      pipelineTasks: [
        {
          taskType: 'translation',
          config: {
            language: { sourceLanguage: sourceLang, targetLanguage: targetLang },
            serviceId,
          },
        },
      ],
      inputData: {
        input: texts.map((source) => ({ source })),
      },
    },
    {
      headers: {
        'Content-Type': 'application/json',
        [inferenceHeaderName]: inferenceHeaderValue,
      },
      timeout: 20_000,
    }
  );

  const output = response.data?.pipelineResponse?.[0]?.output;
  if (!Array.isArray(output) || output.length !== texts.length) {
    const err = new Error('Bhashini returned an unexpected translation response shape.');
    err.status = 502;
    throw err;
  }

  return output.map((item, i) => item?.target || texts[i]);
}

module.exports = { translateBatch };
