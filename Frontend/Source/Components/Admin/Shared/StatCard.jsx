import { memo } from 'react';

const StatCard = memo(({ icon, label, value, sub, isLoading = false }) => {
  const Icon = icon;

  if (isLoading) {
    return (
      <div className="app-surface rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg skeleton" />
          <div className="h-3 w-20 rounded skeleton" />
        </div>
        <div className="h-7 w-16 rounded skeleton mb-1" />
        <div className="h-3 w-24 rounded skeleton mt-2" />
      </div>
    );
  }

  return (
    <div className="app-surface rounded-xl p-4" aria-live="polite">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-lg app-surface-subtle border app-border">
          {Icon && <Icon size={16} className="app-text" />}
        </div>
        <span className="text-xs uppercase tracking-wider app-muted font-semibold">{label}</span>
      </div>
      <p className="text-2xl font-semibold app-title tabular-nums">{value ?? '\u2014'}</p>
      {sub && <p className="text-xs app-muted mt-1">{sub}</p>}
    </div>
  );
});

StatCard.displayName = 'StatCard';

export default StatCard;
