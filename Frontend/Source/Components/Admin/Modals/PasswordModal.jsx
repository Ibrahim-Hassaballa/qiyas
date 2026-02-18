import { useState, useMemo, useCallback } from 'react';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useLocale } from '../../../Context/LocaleContext';
import BaseModal from '../Shared/BaseModal';
import FormField from '../Shared/FormField';

const getStrength = (pw) => {
  if (!pw || pw.length < 6) return { level: 'weak', pct: Math.min((pw?.length || 0) / 6 * 33, 33) };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { level: 'weak', pct: 33 };
  if (score <= 3) return { level: 'fair', pct: 66 };
  return { level: 'strong', pct: 100 };
};

const strengthColors = {
  weak: 'bg-red-500',
  fair: 'bg-amber-500',
  strong: 'bg-[var(--success-500)]',
};

const PasswordModal = ({ onSave, onClose }) => {
  const [pw, setPw] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const { t } = useLocale();

  const strength = useMemo(() => getStrength(pw), [pw]);
  const isValid = pw.length >= 6;

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!isValid || saving) return;
    setSaving(true);
    try {
      await onSave(pw);
    } finally {
      setSaving(false);
    }
  }, [isValid, saving, onSave, pw]);

  return (
    <BaseModal
      isOpen
      onClose={onClose}
      title={t('admin.resetPassword')}
      maxWidth="max-w-sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label={t('admin.newPassword')} htmlFor="new-password">
          <div className="relative">
            <input
              id="new-password"
              className="w-full px-3 py-2 pe-10 rounded-lg text-sm input-surface"
              type={showPassword ? 'text' : 'password'}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder={t('admin.newPasswordPlaceholder')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute end-2 top-1/2 -translate-y-1/2 p-1 rounded btn-ghost focus-ring"
              aria-label={showPassword ? t('admin.hidePassword') : t('admin.showPassword')}
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </FormField>

        {/* Password strength indicator */}
        {pw && (
          <div className="space-y-1" aria-live="polite">
            <div className="w-full h-1.5 bg-[var(--surface-strong)] rounded-full overflow-hidden">
              <div
                className={`h-full ${strengthColors[strength.level]} rounded-full strength-bar`}
                style={{ width: `${strength.pct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="app-muted">{t('admin.passwordStrength')}</span>
              <span className="app-text font-medium">{t(`admin.${strength.level}`)}</span>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={!isValid || saving}
          className="w-full py-2.5 rounded-lg btn-primary text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring flex items-center justify-center gap-2"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {t('admin.resetPasswordAction')}
        </button>
      </form>
    </BaseModal>
  );
};

export default PasswordModal;
