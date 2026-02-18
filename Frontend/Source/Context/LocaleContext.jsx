import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import i18n, { dirForLocale, normalizeLocale } from '../i18n';

const STORAGE_KEY = 'locale';
const FALLBACK_LOCALE = 'en';

const LocaleContext = createContext(null);

const getInitialLocale = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return normalizeLocale(stored);
  return normalizeLocale(navigator.language || FALLBACK_LOCALE);
};

export const LocaleProvider = ({ children }) => {
  const [locale, setLocaleState] = useState(getInitialLocale);
  if (i18n.language !== locale) i18n.changeLanguage(locale);
  const dir = useMemo(() => dirForLocale(locale), [locale]);

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute('lang', locale);
    html.setAttribute('dir', dir);
    localStorage.setItem(STORAGE_KEY, locale);
  }, [locale, dir]);

  const setLocale = useCallback((nextLocale) => {
    const normalized = normalizeLocale(nextLocale);
    i18n.changeLanguage(normalized);
    setLocaleState(normalized);
  }, []);

  const t = useCallback((key, options) => i18n.t(key, options), [locale]);

  const formatNumber = useCallback(
    (value, options = {}) => {
      const safeValue = Number.isFinite(value) ? value : Number(value) || 0;
      const localeCode = locale === 'ar' ? 'ar-SA' : 'en-US';
      return new Intl.NumberFormat(localeCode, options).format(safeValue);
    },
    [locale]
  );

  const formatDate = useCallback(
    (value, options = {}) => {
      if (!value) return '-';
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return '-';
      const localeCode = locale === 'ar' ? 'ar-SA' : 'en-US';
      return new Intl.DateTimeFormat(localeCode, options).format(date);
    },
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      dir,
      t,
      formatNumber,
      formatDate
    }),
    [locale, setLocale, dir, t, formatNumber, formatDate]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useLocale = () => {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
};
