import { useState, useMemo, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, Users, Eye, KeyRound, RotateCcw } from 'lucide-react';
import { useLocale } from '../../Context/LocaleContext';
import DataTable from './Shared/DataTable';
import Badge from './Shared/Badge';
import ProgressBar from './Shared/ProgressBar';
import RowActionsMenu from './Shared/RowActionsMenu';

const UsersTab = ({
  users,
  tenants,
  userTenantFilter,
  onTenantFilterChange,
  page,
  pageSize,
  onPageChange,
  isLoading,
  onEdit,
  onDelete,
  onNew,
  onResetPassword,
  onResetTokens,
  onViewHistory,
}) => {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const { t, formatNumber } = useLocale();

  const handleSort = useCallback((field) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }, [sortField]);

  const processed = useMemo(() => {
    let items = [...(users.items || [])];
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((u) => u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    if (sortField) {
      items.sort((a, b) => {
        let aVal = a[sortField];
        let bVal = b[sortField];
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();
        if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [users.items, search, sortField, sortDir]);

  const columns = useMemo(() => [
    {
      key: 'username',
      label: t('admin.user'),
      sortable: true,
      render: (val) => <span className="font-medium app-text">{val}</span>,
    },
    {
      key: 'email',
      label: t('auth.email'),
      sortable: true,
      hiddenBelow: 'sm',
      render: (val) => <span className="app-muted">{val}</span>,
    },
    {
      key: 'tenant_name',
      label: t('admin.tenant'),
      hiddenBelow: 'lg',
      render: (val) => <span className="app-text">{val}</span>,
    },
    {
      key: 'role',
      label: t('admin.role'),
      render: (val) => (
        <Badge color={val === 'owner' ? 'purple' : val === 'admin' ? 'blue' : 'slate'}>
          {t(`status.${val}`)}
        </Badge>
      ),
    },
    {
      key: 'cost_used',
      label: t('admin.usage'),
      sortable: true,
      hiddenBelow: 'sm',
      render: (val, row) => {
        const costPct = row.cost_limit > 0 ? Math.min(((row.cost_used || 0) / row.cost_limit) * 100, 100) : 0;
        return (
          <div className="min-w-[120px]">
            <div className="flex justify-between text-xs mb-1">
              <span className="app-text font-medium tabular-nums">
                ${formatNumber(row.cost_used || 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="app-muted tabular-nums">
                / ${formatNumber(row.cost_limit || 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <ProgressBar value={costPct} max={100} label={t('admin.usage')} />
            <div className="text-[10px] app-muted mt-0.5 tabular-nums">
              {formatNumber(row.tokens_used || 0)} {t('admin.tokens')}
            </div>
          </div>
        );
      },
    },
    {
      key: 'total_cost_lifetime',
      label: t('admin.lifetime'),
      sortable: true,
      hiddenBelow: 'lg',
      render: (val, row) => (
        <div className="min-w-[100px]">
          <span className="text-sm font-medium text-[var(--accent-500)] tabular-nums">
            ${formatNumber(row.total_cost_lifetime || 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <div className="text-[10px] app-muted mt-0.5 tabular-nums">
            {formatNumber(row.total_tokens_lifetime || 0)} {t('admin.tokens')}
          </div>
        </div>
      ),
    },
    {
      key: 'is_active',
      label: t('common.status'),
      render: (val) => (
        <Badge color={val ? 'green' : 'red'}>
          {val ? t('common.active') : t('common.inactive')}
        </Badge>
      ),
    },
  ], [t, formatNumber]);

  const actions = useCallback((row) => (
    <div className="flex items-center justify-end gap-px">
      <button
        onClick={() => onEdit(row)}
        className="p-1.5 rounded-lg btn-ghost focus-ring"
        aria-label={`${t('common.edit')} ${row.username}`}
      >
        <Pencil size={14} />
      </button>
      <button
        onClick={() => onDelete(row.id)}
        className="p-1.5 rounded-lg btn-ghost focus-ring"
        aria-label={`${t('common.delete')} ${row.username}`}
      >
        <Trash2 size={14} />
      </button>
      <RowActionsMenu
        label={t('admin.moreActions')}
        items={[
          { label: t('admin.viewHistory'), icon: Eye, onClick: () => onViewHistory(row.id, row.username) },
          { label: t('admin.resetPassword'), icon: KeyRound, onClick: () => onResetPassword(row.id) },
          { label: t('admin.resetTokens'), icon: RotateCcw, onClick: () => onResetTokens(row) },
        ]}
      />
    </div>
  ), [onEdit, onDelete, onViewHistory, onResetPassword, onResetTokens, t]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-base font-semibold app-title">
          {t('admin.usersTitle', { count: formatNumber(users.total) })}
        </h3>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 app-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('admin.searchUsers')}
              className="ps-9 pe-3 py-1.5 rounded-lg text-sm input-surface w-44"
              aria-label={t('admin.searchUsers')}
            />
          </div>
          <select
            value={userTenantFilter}
            onChange={(e) => onTenantFilterChange(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm input-surface"
            aria-label={t('admin.allTenants')}
          >
            <option value="">{t('admin.allTenants')}</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
          <button
            onClick={onNew}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg btn-primary text-sm font-medium focus-ring"
          >
            <Plus size={14} /> {t('admin.newUser')}
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={processed}
        totalCount={search ? processed.length : users.total}
        page={search ? 1 : page}
        pageSize={pageSize}
        onPageChange={search ? undefined : onPageChange}
        sortField={sortField}
        sortDir={sortDir}
        onSort={handleSort}
        isLoading={isLoading}
        emptyIcon={Users}
        emptyTitle={t('admin.noUsersFound')}
        actions={actions}
        ariaLabel={t('admin.users')}
      />
    </div>
  );
};

export default UsersTab;
