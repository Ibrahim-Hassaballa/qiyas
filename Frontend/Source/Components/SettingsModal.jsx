import React, { useEffect, useRef } from 'react';
import {
  Settings,
  Sun,
  Moon,
  X
} from 'lucide-react';
import { useLocale } from '../Context/LocaleContext';
import LanguageSwitcher from './LanguageSwitcher';

const SettingsModal = ({
  isOpen,
  onClose,
  theme,
  setTheme
}) => {
  const modalRef = useRef(null);
  const { t } = useLocale();

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !modalRef.current) return;
    const focusable = modalRef.current.querySelectorAll(
      'button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) focusable[0].focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('settings.title')}
    >
      <div
        ref={modalRef}
        className="app-surface-elevated rounded-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh] transition-colors animate-message-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b app-border flex justify-between items-center">
          <h3 className="text-lg font-semibold app-title flex items-center gap-2">
            <Settings size={18} /> {t('settings.title')}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg btn-ghost transition-colors focus-ring"
            aria-label={t('common.close')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <div className="space-y-6">
            {/* Appearance */}
            <div>
              <h4 className="text-[13px] font-semibold app-muted uppercase tracking-wider mb-3">{t('settings.appearance')}</h4>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all focus-ring ${
                    theme === 'light' ? 'status-info' : 'btn-secondary'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${theme === 'light' ? 'status-info' : 'app-surface-subtle app-text'}`}>
                    <Sun size={18} />
                  </div>
                  <div className="text-start">
                    <div className="text-sm font-medium">{t('theme.light')}</div>
                    <div className="text-[10px] opacity-80">{t('theme.lightHint')}</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all focus-ring ${
                    theme === 'dark' ? 'status-info' : 'btn-secondary'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${theme === 'dark' ? 'status-info' : 'app-surface-subtle app-text'}`}>
                    <Moon size={18} />
                  </div>
                  <div className="text-start">
                    <div className="text-sm font-medium">{t('theme.dark')}</div>
                    <div className="text-[10px] opacity-80">{t('theme.darkHint')}</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Language */}
            <div>
              <h4 className="text-[13px] font-semibold app-muted uppercase tracking-wider mb-3">{t('language.label')}</h4>
              <LanguageSwitcher compact />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
