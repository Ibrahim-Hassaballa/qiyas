import { useState, useCallback, useMemo } from 'react';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useLocale } from '../../../Context/LocaleContext';
import BaseModal from '../Shared/BaseModal';
import FormField from '../Shared/FormField';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const UserModal = ({ user: editUser, tenants, onSave, onClose }) => {
  const [email, setEmail] = useState(editUser?.email || '');
  const [username, setUsername] = useState(editUser?.username || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState(editUser?.role || 'member');
  const [tenantId, setTenantId] = useState(editUser?.tenant_id || (tenants[0]?.id || ''));
  const [isActive, setIsActive] = useState(editUser?.is_active ?? true);
  const [costLimit, setCostLimit] = useState(editUser?.cost_limit ?? 5.0);
  const [emailTouched, setEmailTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const { t } = useLocale();

  const emailError = useMemo(() => {
    if (!emailTouched || !email) return null;
    return !emailRegex.test(email) ? t('errors.generic') : null;
  }, [email, emailTouched, t]);

  const isValid = email && username && (editUser || (password && password.length >= 6));

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!isValid || saving) return;
    setSaving(true);
    try {
      const data = editUser
        ? { tenant_id: tenantId, email, username, role, is_active: isActive, cost_limit: costLimit }
        : { tenant_id: tenantId, email, username, password, role };
      await onSave(data);
    } finally {
      setSaving(false);
    }
  }, [isValid, saving, editUser, tenantId, email, username, password, role, isActive, costLimit, onSave]);

  return (
    <BaseModal
      isOpen
      onClose={onClose}
      title={editUser ? t('admin.editUser') : t('admin.newUserTitle')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label={t('admin.tenant')} htmlFor="user-tenant">
          <select
            id="user-tenant"
            className="w-full px-3 py-2 rounded-lg text-sm input-surface"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
          >
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
            ))}
          </select>
        </FormField>

        <FormField label={t('auth.email')} htmlFor="user-email" error={emailError}>
          <input
            id="user-email"
            className={`w-full px-3 py-2 rounded-lg text-sm input-surface ${emailError ? 'border-[var(--danger-500)]' : ''}`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setEmailTouched(true)}
            placeholder="user@example.com"
          />
        </FormField>

        <FormField label={t('admin.user')} htmlFor="user-username">
          <input
            id="user-username"
            className="w-full px-3 py-2 rounded-lg text-sm input-surface"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t('auth.chooseDisplayName')}
          />
        </FormField>

        {!editUser && (
          <FormField label={t('auth.password')} htmlFor="user-password">
            <div className="relative">
              <input
                id="user-password"
                className="w-full px-3 py-2 pe-10 rounded-lg text-sm input-surface"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.choosePassword')}
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
        )}

        <FormField label={t('admin.role')} htmlFor="user-role">
          <select
            id="user-role"
            className="w-full px-3 py-2 rounded-lg text-sm input-surface"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="member">{t('status.member')}</option>
            <option value="admin">{t('status.admin')}</option>
            <option value="owner">{t('status.owner')}</option>
          </select>
        </FormField>

        {editUser && (
          <FormField label={t('admin.budgetLimit')} htmlFor="user-cost-limit">
            <input
              id="user-cost-limit"
              className="w-full px-3 py-2 rounded-lg text-sm input-surface"
              type="number"
              min="0"
              step="0.01"
              value={costLimit}
              onChange={(e) => setCostLimit(parseFloat(e.target.value) || 0)}
            />
          </FormField>
        )}

        {editUser && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded app-border" />
            <span className="text-sm app-text">{t('admin.activeLabel')}</span>
          </label>
        )}

        <button
          type="submit"
          disabled={!isValid || saving}
          className="w-full py-2.5 rounded-lg btn-primary text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring flex items-center justify-center gap-2"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {editUser ? t('admin.updateUserAction') : t('admin.createUserAction')}
        </button>
      </form>
    </BaseModal>
  );
};

export default UserModal;
