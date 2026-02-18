import { useMemo } from 'react';
import { Loader2, Save } from 'lucide-react';
import { useLocale } from '../../Context/LocaleContext';

const PromptsTab = ({
  tenantSettings,
  savedSettings,
  onSettingsChange,
  onSaveSettings,
  isSavingSettings,
  isLoading = false,
}) => {
  const { t } = useLocale();

  const isDirty = useMemo(() => {
    if (!savedSettings) return false;
    return (
      tenantSettings.system_prompt !== savedSettings.system_prompt ||
      (tenantSettings.topic_guard_prompt || '') !== (savedSettings.topic_guard_prompt || '')
    );
  }, [tenantSettings, savedSettings]);

  if (isLoading && !savedSettings) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div className="h-8 w-40 rounded skeleton" />
        <div className="h-64 rounded-lg skeleton" />
        <div className="h-8 w-40 rounded skeleton" />
        <div className="h-64 rounded-lg skeleton" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Dirty indicator */}
      {isDirty && (
        <div className="status-warning px-3 py-2 rounded-lg text-xs font-medium">
          {t('admin.unsavedChanges')}
        </div>
      )}

      {/* System Prompt */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold app-title">{t('settings.systemPrompt')}</h3>
        <div className="status-warning p-3 rounded-lg text-xs">{t('settings.systemPromptWarning')}</div>
        <textarea
          id="system-prompt"
          value={tenantSettings.system_prompt || ''}
          onChange={(e) => onSettingsChange({ system_prompt: e.target.value })}
          className="w-full p-4 rounded-lg font-mono text-xs leading-relaxed resize-none input-surface custom-scrollbar"
          style={{ minHeight: '280px' }}
          placeholder={t('settings.systemPromptPlaceholder')}
          aria-label={t('settings.systemPrompt')}
          dir="ltr"
        />
      </div>

      {/* Topic Guard */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold app-title">{t('settings.topicGuard')}</h3>
        <div className="status-warning p-3 rounded-lg text-xs">{t('settings.topicGuardWarning')}</div>
        <textarea
          id="topic-guard"
          value={tenantSettings.topic_guard_prompt || ''}
          onChange={(e) => onSettingsChange({ topic_guard_prompt: e.target.value })}
          className="w-full p-4 rounded-lg font-mono text-xs leading-relaxed resize-none input-surface custom-scrollbar"
          style={{ minHeight: '280px' }}
          placeholder={t('settings.topicGuardPlaceholder')}
          aria-label={t('settings.topicGuard')}
          dir="auto"
        />
      </div>

      {/* Save button */}
      <button
        onClick={onSaveSettings}
        disabled={isSavingSettings || !isDirty}
        className="w-full py-3 btn-primary rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 focus-ring"
      >
        {isSavingSettings ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
        {t('common.saveChanges')}
      </button>
    </div>
  );
};

export default PromptsTab;
