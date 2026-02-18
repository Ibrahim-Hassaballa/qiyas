import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import ar from './ar.json';

export const SUPPORTED_LOCALES = ['en', 'ar'];

export const normalizeLocale = (value) => {
  if (!value) return 'en';
  const locale = String(value).toLowerCase();
  if (locale.startsWith('ar')) return 'ar';
  return 'en';
};

export const dirForLocale = (locale) => (normalizeLocale(locale) === 'ar' ? 'rtl' : 'ltr');

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        ar: { translation: ar }
      },
      lng: 'en',
      fallbackLng: 'en',
      supportedLngs: SUPPORTED_LOCALES,
      interpolation: {
        escapeValue: false
      },
      returnNull: false
    });
}

export default i18n;
