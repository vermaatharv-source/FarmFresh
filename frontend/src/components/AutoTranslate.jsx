import { useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';

/**
 * <AutoTranslate> wraps a subtree and live-translates every visible text
 * node inside it (plus input/textarea placeholders) whenever the selected
 * language changes — without needing every label/button in the wrapped
 * pages to be manually rewritten to use a translation hook.
 *
 * How it works:
 *  - Walks the DOM with a TreeWalker, collecting text nodes (skipping
 *    <script>/<style>, anything marked data-no-translate, and whitespace).
 *  - Remembers each node's original English text in a WeakMap so
 *    switching back to English is instant (no API call).
 *  - If React re-renders a node with genuinely new text (e.g. a dynamic
 *    value changed), that's detected by comparing against what we last
 *    wrote, and the new text is treated as a fresh "original" to translate.
 *  - A MutationObserver catches content that loads in later (e.g. a
 *    farmers list that arrives after an API call) and translates just the
 *    new nodes, debounced so a batch of DOM updates becomes one API call.
 *
 * Usage: wrap the dashboard's returned JSX once —
 *   <AutoTranslate><div className="dashboard">...</div></AutoTranslate>
 *
 * Exclude anything that must never be translated (raw IDs, phone numbers,
 * code) by adding data-no-translate to that element.
 */
export default function AutoTranslate({ children }) {
  const { language, translateBatch } = useLanguage();
  const containerRef = useRef(null);
  const nodeInfo = useRef(new WeakMap()); // Node -> { original, translated }
  const attrInfo = useRef(new WeakMap()); // Element -> { original, translated }
  const applyingCountRef = useRef(0);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const runTranslation = () => runTranslationPass({
      container: containerRef.current,
      language,
      translateBatch,
      nodeInfo: nodeInfo.current,
      attrInfo: attrInfo.current,
      applyingCountRef,
    });

    runTranslation();

    const observer = new MutationObserver(() => {
      if (applyingCountRef.current > 0) return; // ignore our own writes
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(runTranslation, 350);
    });

    observer.observe(containerRef.current, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  return <div ref={containerRef}>{children}</div>;
}

function isSkippable(el) {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return true;
  return !!el.closest?.('[data-no-translate]');
}

function collectTextNodes(container) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      if (isSkippable(node.parentElement)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes = [];
  let current;
  // eslint-disable-next-line no-cond-assign
  while ((current = walker.nextNode())) nodes.push(current);
  return nodes;
}

function collectPlaceholderElements(container) {
  return Array.from(container.querySelectorAll('input[placeholder], textarea[placeholder]')).filter(
    (el) => !isSkippable(el)
  );
}

async function runTranslationPass({ container, language, translateBatch, nodeInfo, attrInfo, applyingCountRef }) {
  const textNodes = collectTextNodes(container);
  const placeholderEls = collectPlaceholderElements(container);

  // Resolve each node's "true" original text: if we've translated it
  // before AND its current text still matches what we last wrote, the
  // remembered original is still valid. Otherwise the current text is a
  // fresh original (either untouched, or React just re-rendered new content).
  const resolveOriginal = (currentText, info) => {
    if (info && info.translated === currentText) return info.original;
    return currentText;
  };

  const textOriginals = textNodes.map((n) => resolveOriginal(n.nodeValue, nodeInfo.get(n)));
  const placeholderOriginals = placeholderEls.map((el) =>
    resolveOriginal(el.getAttribute('placeholder'), attrInfo.get(el))
  );

  if (language === 'en') {
    // Restore instantly, no network call.
    applyingCountRef.current++;
    textNodes.forEach((n, i) => {
      n.nodeValue = textOriginals[i];
    });
    placeholderEls.forEach((el, i) => {
      el.setAttribute('placeholder', placeholderOriginals[i]);
    });
    setTimeout(() => applyingCountRef.current--, 0);
    return;
  }

  const allOriginals = [...textOriginals, ...placeholderOriginals];
  if (allOriginals.length === 0) return;

  const translated = await translateBatch(allOriginals);

  applyingCountRef.current++;
  textNodes.forEach((n, i) => {
    const original = textOriginals[i];
    const result = translated[i];
    n.nodeValue = result;
    nodeInfo.set(n, { original, translated: result });
  });
  placeholderEls.forEach((el, i) => {
    const original = placeholderOriginals[i];
    const result = translated[textNodes.length + i];
    el.setAttribute('placeholder', result);
    attrInfo.set(el, { original, translated: result });
  });
  setTimeout(() => applyingCountRef.current--, 0);
}
