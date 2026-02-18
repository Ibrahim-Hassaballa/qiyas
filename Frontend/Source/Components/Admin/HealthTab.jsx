import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useLocale } from '../../Context/LocaleContext';
import formatUptime from '../../utils/formatUptime';

const StatusIcon = ({ status }) => {
  const s = status?.toLowerCase();
  if (s === 'healthy') return <CheckCircle size={16} className="text-[var(--success-500)]" />;
  if (s === 'unhealthy') return <XCircle size={16} className="text-[var(--danger-500)]" />;
  return <AlertTriangle size={16} className="text-[var(--warning-500)]" />;
};

const statusBorderColor = (status) => {
  const s = status?.toLowerCase();
  if (s === 'healthy') return 'border-s-[var(--success-500)]';
  if (s === 'unhealthy') return 'border-s-[var(--danger-500)]';
  return 'border-s-[var(--warning-500)]';
};

const HealthTab = ({ health, isLoading = false }) => {
  const { t } = useLocale();

  // Loading skeleton
  if (isLoading && !health) {
    return (
      <div className="space-y-6">
        <div className="h-12 rounded-lg skeleton" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="app-surface rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="h-4 w-20 rounded skeleton" />
                <div className="h-4 w-4 rounded skeleton" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full rounded skeleton" />
                <div className="h-3 w-3/4 rounded skeleton" />
              </div>
            </div>
          ))}
        </div>
        <div className="app-surface rounded-xl p-5">
          <div className="h-4 w-32 rounded skeleton" />
        </div>
      </div>
    );
  }

  if (!health) return null;

  const allHealthy = health.status === 'ok';

  return (
    <div className="space-y-6">
      {/* Status banner */}
      <div className={`flex items-center gap-3 px-5 py-3 rounded-lg ${allHealthy ? 'status-success' : 'status-warning'}`}>
        <div className={`w-2.5 h-2.5 rounded-full pulse-dot ${allHealthy ? 'bg-[var(--success-500)]' : 'bg-[var(--warning-500)]'}`} />
        <span className="text-sm font-semibold">
          {allHealthy ? t('admin.allSystemsOperational') : t('admin.degradedPerformance')}
        </span>
      </div>

      {/* Component cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(health.components || {}).map(([name, comp]) => (
          <div
            key={name}
            className={`app-surface rounded-xl p-5 border-s-4 ${statusBorderColor(comp.status)}`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold app-text capitalize">{name}</span>
              <StatusIcon status={comp.status} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs app-muted">{t('common.status')}</span>
                <span className="text-xs font-medium">
                  {comp.status === 'healthy' ? t('status.healthy') : comp.status === 'unhealthy' ? t('status.unhealthy') : t('status.unknown')}
                </span>
              </div>
              {comp.type && (
                <div className="flex items-center justify-between">
                  <span className="text-xs app-muted">{t('admin.type')}</span>
                  <span className="text-xs app-text">{comp.type}</span>
                </div>
              )}
              {comp.collections !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-xs app-muted">{t('admin.collections')}</span>
                  <span className="text-xs app-text">{comp.collections}</span>
                </div>
              )}
              {comp.path && (
                <div className="flex items-center justify-between">
                  <span className="text-xs app-muted">{t('admin.path')}</span>
                  <span className="text-xs app-muted font-mono truncate max-w-[150px]">{comp.path}</span>
                </div>
              )}
              {comp.error && <p className="text-xs text-[var(--danger-500)] mt-1 break-all">{comp.error}</p>}
            </div>
          </div>
        ))}
        {Object.keys(health.components || {}).length === 0 && (
          <p className="text-sm app-muted col-span-3">{t('common.noData')}</p>
        )}
      </div>

      {/* Uptime */}
      <div className="app-surface rounded-xl p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider app-muted font-semibold">{t('admin.uptime')}</span>
          <p className="text-lg app-title font-mono tabular-nums">{formatUptime(health.uptime_seconds)}</p>
        </div>
      </div>
    </div>
  );
};

export default HealthTab;
