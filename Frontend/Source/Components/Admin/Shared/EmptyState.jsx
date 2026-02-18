import { memo } from 'react';

const EmptyState = memo(({ icon: Icon, title, description, action, actionLabel }) => (
  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
    {Icon && (
      <div className="p-3 rounded-xl app-surface-subtle border app-border mb-4">
        <Icon size={24} className="app-muted" />
      </div>
    )}
    {title && <h3 className="text-sm font-semibold app-title mb-1">{title}</h3>}
    {description && <p className="text-xs app-muted max-w-xs">{description}</p>}
    {action && actionLabel && (
      <button
        type="button"
        onClick={action}
        className="mt-4 px-4 py-2 rounded-lg btn-primary text-sm font-medium focus-ring"
      >
        {actionLabel}
      </button>
    )}
  </div>
));

EmptyState.displayName = 'EmptyState';

export default EmptyState;
