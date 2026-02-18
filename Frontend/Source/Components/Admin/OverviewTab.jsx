import { Building2, Users, MessageSquare, Activity, BarChart3, AlertTriangle, CheckCircle } from 'lucide-react';
import { useLocale } from '../../Context/LocaleContext';
import StatCard from './Shared/StatCard';
import ProgressBar from './Shared/ProgressBar';
import formatUptime from '../../utils/formatUptime';

const OverviewTab = ({ analytics, isLoading = false }) => {
  const { t, formatNumber, formatDate } = useLocale();

  // Loading skeleton
  if (isLoading && !analytics) {
    return (
      <div className="space-y-6" aria-live="polite">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCard key={i} isLoading />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <StatCard key={i} isLoading />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="app-surface rounded-xl p-5">
            <div className="h-4 w-32 rounded skeleton mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="h-3 w-full rounded skeleton" />
                  <div className="h-1.5 w-full rounded skeleton" />
                </div>
              ))}
            </div>
          </div>
          <div className="app-surface rounded-xl p-5">
            <div className="h-4 w-32 rounded skeleton mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="h-3 w-full rounded skeleton" />
                  <div className="h-1.5 w-full rounded skeleton" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  const planTotal = Object.values(analytics.plan_distribution || {}).reduce((a, b) => a + b, 0) || 1;
  const planColors = { enterprise: 'bg-purple-500', pro: 'bg-blue-500', free: 'bg-slate-500' };
  const topConsumers = analytics.token_usage?.top_consumers || [];

  return (
    <div className="space-y-6" aria-live="polite">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Building2}
          label={t('admin.tenantsMetric')}
          value={formatNumber(analytics.totals.tenants)}
          sub={`${formatNumber(analytics.totals.active_tenants)} ${t('admin.activeSuffix')}`}
        />
        <StatCard
          icon={Users}
          label={t('admin.usersMetric')}
          value={formatNumber(analytics.totals.users)}
          sub={`${formatNumber(analytics.totals.active_users)} ${t('admin.activeSuffix')}`}
        />
        <StatCard
          icon={MessageSquare}
          label={t('admin.conversationsMetric')}
          value={formatNumber(analytics.totals.conversations)}
          sub={`${formatNumber(analytics.today.conversations)} ${t('admin.todaySuffix')}`}
        />
        <StatCard
          icon={Activity}
          label={t('admin.messagesMetric')}
          value={formatNumber(analytics.totals.messages)}
          sub={`${formatNumber(analytics.today.messages)} ${t('admin.todaySuffix')}`}
        />
      </div>

      {analytics.token_usage && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            icon={BarChart3}
            label={t('admin.totalCost')}
            value={`$${formatNumber(analytics.token_usage.total_cost || 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            sub={`${formatNumber(analytics.token_usage.total_consumed || 0)} ${t('admin.tokens')}`}
          />
          <StatCard
            icon={AlertTriangle}
            label={t('admin.budgetAlerts')}
            value={formatNumber(analytics.token_usage.users_at_cost_limit || 0)}
            sub={t('admin.usersAtCostLimit')}
          />
          <StatCard
            icon={Activity}
            label={t('admin.tokenAlerts')}
            value={formatNumber(analytics.token_usage.users_at_limit || 0)}
            sub={t('admin.usersAtTokenLimit')}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Consumers */}
        <div className="app-surface rounded-xl p-5">
          <h3 className="text-xs uppercase tracking-wider app-muted font-semibold mb-4">{t('admin.topConsumers')}</h3>
          {topConsumers.length > 0 ? (
            <div className="space-y-3">
              {topConsumers.map((u, i) => (
                <div key={u.username || i} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="app-text truncate">{u.username}</span>
                    <span className="app-muted tabular-nums">{formatNumber(u.tokens_used)}</span>
                  </div>
                  <ProgressBar
                    value={u.tokens_used}
                    max={u.token_limit || 1}
                    label={`${u.username} token usage`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm app-muted">{t('common.noData')}</p>
          )}
        </div>

        {/* Plan Distribution — stacked bar */}
        <div className="app-surface rounded-xl p-5">
          <h3 className="text-xs uppercase tracking-wider app-muted font-semibold mb-4">{t('admin.planDistribution')}</h3>
          {Object.keys(analytics.plan_distribution || {}).length > 0 ? (
            <>
              {/* Stacked bar */}
              <div className="w-full h-3 rounded-full overflow-hidden flex mb-4">
                {Object.entries(analytics.plan_distribution || {}).map(([plan, count]) => {
                  const pct = (count / planTotal) * 100;
                  return (
                    <div
                      key={plan}
                      className={`h-full ${planColors[plan] || 'bg-slate-600'} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                      title={`${t(`status.${plan}`)}: ${count} (${Math.round(pct)}%)`}
                    />
                  );
                })}
              </div>
              {/* Legend */}
              <div className="space-y-2">
                {Object.entries(analytics.plan_distribution || {}).map(([plan, count]) => {
                  const pct = ((count / planTotal) * 100).toFixed(0);
                  return (
                    <div key={plan} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${planColors[plan] || 'bg-slate-600'}`} />
                        <span className="app-text capitalize">{t(`status.${plan}`)}</span>
                      </div>
                      <span className="app-muted tabular-nums">{formatNumber(count)} ({formatNumber(Number(pct))}%)</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-sm app-muted">{t('common.noData')}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Conversations */}
        <div className="app-surface rounded-xl p-5">
          <h3 className="text-xs uppercase tracking-wider app-muted font-semibold mb-4">{t('admin.recentConversations')}</h3>
          <div className="space-y-1">
            {(analytics.recent_conversations || []).slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[var(--surface-subtle)] transition-colors">
                <span className="text-sm app-text truncate max-w-[200px] line-clamp-1">{c.title}</span>
                <span className="text-xs app-muted tabular-nums shrink-0 ms-2">{c.created_at ? formatDate(c.created_at) : '-'}</span>
              </div>
            ))}
            {(analytics.recent_conversations || []).length === 0 && (
              <p className="text-sm app-muted">{t('admin.noConversationsYet')}</p>
            )}
          </div>
        </div>

        {/* System Uptime */}
        <div className="app-surface rounded-xl p-5">
          <h3 className="text-xs uppercase tracking-wider app-muted font-semibold mb-3">{t('admin.systemUptime')}</h3>
          <div className="flex items-center gap-3">
            <CheckCircle size={18} className="text-[var(--success-500)]" />
            <p className="text-lg app-title font-mono tabular-nums">{formatUptime(analytics.uptime_seconds)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;
