import { useState, useCallback } from 'react';
import { useLocale } from '../../../Context/LocaleContext';
import BaseModal from '../Shared/BaseModal';
import FormField from '../Shared/FormField';
import { Loader2 } from 'lucide-react';

const TenantModal = ({ tenant, onSave, onClose }) => {
  const [name, setName] = useState(tenant?.name || '');
  const [nameAr, setNameAr] = useState(tenant?.name_ar || '');
  const [slug, setSlug] = useState(tenant?.slug || '');
  const [plan, setPlan] = useState(tenant?.plan || 'free');
  const [isActive, setIsActive] = useState(tenant?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const { t } = useLocale();

  const isValid = name.trim() && nameAr.trim();

  const handleNameBlur = useCallback(() => {
    if (!slug && name.trim()) {
      setSlug(name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
  }, [slug, name]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!isValid || saving) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        name_ar: nameAr.trim(),
        slug: slug || undefined,
        plan,
        ...(tenant ? { is_active: isActive } : {}),
      });
    } finally {
      setSaving(false);
    }
  }, [isValid, saving, onSave, name, nameAr, slug, plan, tenant, isActive]);

  return (
    <BaseModal
      isOpen
      onClose={onClose}
      title={tenant ? t('admin.editTenant') : t('admin.newTenantTitle')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label={t('admin.organizationName')} htmlFor="tenant-name" required>
          <input
            id="tenant-name"
            className="w-full px-3 py-2 rounded-lg text-sm input-surface"
            dir="ltr"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            placeholder={t('admin.organizationNamePlaceholder')}
            required
          />
        </FormField>

        <FormField label={t('admin.organizationNameAr')} htmlFor="tenant-name-ar" required>
          <input
            id="tenant-name-ar"
            className="w-full px-3 py-2 rounded-lg text-sm input-surface"
            dir="rtl"
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            placeholder={t('admin.organizationNameArPlaceholder')}
            required
          />
        </FormField>

        <FormField label={t('admin.slug')} htmlFor="tenant-slug">
          <input
            id="tenant-slug"
            className="w-full px-3 py-2 rounded-lg text-sm input-surface"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder={t('admin.slugPlaceholder')}
          />
        </FormField>

        <FormField label={t('admin.plan')} htmlFor="tenant-plan">
          <select
            id="tenant-plan"
            className="w-full px-3 py-2 rounded-lg text-sm input-surface"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
          >
            <option value="free">{t('status.free')}</option>
            <option value="pro">{t('status.pro')}</option>
            <option value="enterprise">{t('status.enterprise')}</option>
          </select>
        </FormField>

        {tenant && (
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
          {tenant ? t('admin.updateTenantAction') : t('admin.newTenantAction')}
        </button>
      </form>
    </BaseModal>
  );
};

export default TenantModal;
