import { useLocale } from '../../../Context/LocaleContext';
import BaseModal from '../Shared/BaseModal';
import Badge from '../Shared/Badge';

const UsageHistoryModal = ({ username, resets, onClose }) => {
  const { t, formatDate, formatNumber } = useLocale();

  return (
    <BaseModal
      isOpen
      onClose={onClose}
      title={t('admin.usageHistory', { username: username || t('admin.user') })}
    >
      <div className="max-h-[400px] overflow-y-auto custom-scrollbar space-y-3">
        {resets.length === 0 ? (
          <p className="text-sm app-muted text-center py-8">{t('admin.noResetHistory')}</p>
        ) : (
          resets.map((reset) => (
            <div key={reset.id} className="rounded-lg app-surface-subtle p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs app-muted">
                  {reset.reset_at ? formatDate(reset.reset_at, { dateStyle: 'medium', timeStyle: 'short' }) : '-'}
                </span>
                <Badge color="slate">{t('admin.resetBy', { username: reset.reset_by_username })}</Badge>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-xs app-muted">{t('admin.cost')}</span>
                  <p className="text-sm font-medium text-[var(--warning-500)]">
                    ${formatNumber(reset.cost_used_before_reset || 0, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                  </p>
                </div>
                <div>
                  <span className="text-xs app-muted">{t('admin.tokens')}</span>
                  <p className="text-sm font-medium text-[var(--accent-500)]">
                    {formatNumber(reset.tokens_used_before_reset || 0)}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <button onClick={onClose} className="w-full mt-4 py-2.5 rounded-lg btn-secondary text-sm font-medium transition-colors focus-ring">
        {t('common.close')}
      </button>
    </BaseModal>
  );
};

export default UsageHistoryModal;
