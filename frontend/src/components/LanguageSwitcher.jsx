import { useLanguage } from '../context/LanguageContext';

/**
 * Language picker — styled to stay readable on the dark FPO sidebar.
 */
export default function LanguageSwitcher({ className = '' }) {
  const { language, setLanguage, languages } = useLanguage();

  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        Language
      </span>
      <div className="relative">
        <select
          data-no-translate
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          aria-label="Select language"
          className="w-full cursor-pointer appearance-none rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 pr-9 text-sm font-medium text-white shadow-inner outline-none transition hover:border-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
        >
          {languages.map((l) => (
            <option key={l.code} value={l.code} className="bg-slate-800 text-white">
              {l.label}
            </option>
          ))}
        </select>
        {/* Chevron */}
        <span
          className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400"
          aria-hidden
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </div>
    </label>
  );
}