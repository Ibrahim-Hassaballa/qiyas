import React from 'react';
import { Languages } from 'lucide-react';
import { useLocale } from '../Context/LocaleContext';

const LanguageSwitcher = ({ compact = false, className = '' }) => {
  const { locale, setLocale, t } = useLocale();

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {!compact && (
        <span className="text-xs font-medium app-muted flex items-center gap-1">
          <Languages size={14} />
          {t('language.label')}
        </span>
      )}
      <div className="inline-flex rounded-lg border app-border overflow-hidden">
        <button
          type="button"
          onClick={() => setLocale('en')}
          className={`px-3 py-1.5 text-xs font-semibold transition-colors focus-ring ${
            locale === 'en'
              ? 'btn-primary'
              : 'app-surface-subtle app-text hover:brightness-95'
          }`}
          aria-label={t('language.english')}
          aria-pressed={locale === 'en'}
        >
          EN
        </button>
        <button
          type="button"
          onClick={() => setLocale('ar')}
          className={`px-3 py-1.5 text-xs font-semibold transition-colors focus-ring ${
            locale === 'ar'
              ? 'btn-primary'
              : 'app-surface-subtle app-text hover:brightness-95'
          }`}
          aria-label={t('language.arabic')}
          aria-pressed={locale === 'ar'}
        >
          عربي
        </button>
      </div>
    </div>
  );
};

export default LanguageSwitcher;
