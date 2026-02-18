import { useMemo } from 'react';
import { Brain, Cpu, Loader2, Save } from 'lucide-react';
import { useLocale } from '../../Context/LocaleContext';
import Toggle from './Shared/Toggle';

const AIModelTab = ({
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
      tenantSettings.context_memory_enabled !== savedSettings.context_memory_enabled ||
      tenantSettings.model_provider !== savedSettings.model_provider ||
      tenantSettings.groq_model !== savedSettings.groq_model
    );
  }, [tenantSettings, savedSettings]);

  if (isLoading && !savedSettings) {
    return (
      <div className="space-y-6">
        <div className="h-20 rounded-lg skeleton" />
        <div className="h-10 w-40 rounded skeleton" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-20 rounded-lg skeleton" />
          <div className="h-20 rounded-lg skeleton" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Dirty indicator */}
      {isDirty && (
        <div className="status-warning px-3 py-2 rounded-lg text-xs font-medium">
          {t('admin.unsavedChanges')}
        </div>
      )}

      {/* Context Memory */}
      <div className="p-4 app-surface-subtle rounded-lg flex justify-between items-center transition-colors">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${tenantSettings.context_memory_enabled ? 'status-info' : 'chip-surface'}`}>
            <Brain size={20} />
          </div>
          <div>
            <h4 className="text-sm font-medium app-title">{t('settings.contextMemory')}</h4>
            <p className="text-xs app-muted">{t('settings.contextMemoryHint')}</p>
          </div>
        </div>
        <Toggle
          checked={tenantSettings.context_memory_enabled}
          onChange={(val) => onSettingsChange({ context_memory_enabled: val })}
          label={t('settings.contextMemory')}
        />
      </div>

      {/* Model Provider */}
      <div>
        <h4 className="text-[13px] font-semibold app-muted uppercase tracking-wider mb-3">{t('settings.modelProvider')}</h4>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onSettingsChange({ model_provider: 'azure' })}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-all focus-ring ${
              tenantSettings.model_provider === 'azure' ? 'status-info' : 'btn-secondary'
            }`}
          >
            <div className={`p-2 rounded-lg ${tenantSettings.model_provider === 'azure' ? 'status-info' : 'chip-surface'}`}>
              <Cpu size={18} />
            </div>
            <div className="text-start">
              <div className="text-sm font-medium">{t('settings.azure')}</div>
              <div className="text-[10px] opacity-70">{t('settings.azureHint')}</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSettingsChange({ model_provider: 'groq' })}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-all focus-ring ${
              tenantSettings.model_provider === 'groq' ? 'status-info' : 'btn-secondary'
            }`}
          >
            <div className={`p-2 rounded-lg ${tenantSettings.model_provider === 'groq' ? 'status-info' : 'chip-surface'}`}>
              <Cpu size={18} />
            </div>
            <div className="text-start">
              <div className="text-sm font-medium">{t('settings.groq')}</div>
              <div className="text-[10px] opacity-70">{t('settings.groqHint')}</div>
            </div>
          </button>
        </div>

        {tenantSettings.model_provider === 'groq' && (
          <div className="mt-3">
            <label htmlFor="groq-model" className="text-xs app-muted mb-1.5 block">{t('settings.groqModel')}</label>
            <select
              id="groq-model"
              value={tenantSettings.groq_model}
              onChange={(e) => onSettingsChange({ groq_model: e.target.value })}
              className="w-full p-2.5 rounded-lg text-sm input-surface"
            >
              <option value="" disabled>{t('settings.selectModel')}</option>
              <option value="openai/gpt-oss-120b">GPT OSS 120b</option>
              <option value="moonshotai/kimi-k2-instruct-0905">Kimi k2</option>
            </select>
          </div>
        )}
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

export default AIModelTab;
