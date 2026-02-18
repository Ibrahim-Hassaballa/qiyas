import { useState, useMemo, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, Building2 } from 'lucide-react';
import { useLocale } from '../../Context/LocaleContext';
import DataTable from './Shared/DataTable';
import Badge from './Shared/Badge';

const TenantsTab = ({ tenants, page, pageSize, onPageChange, isLoading, onEdit, onDelete, onNew }) => {
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

  const filtered = useMemo(() => {
    let items = tenants.items || [];
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (tenant) =>
          tenant.name.toLowerCase().includes(q) ||
          (tenant.name_ar || '').toLowerCase().includes(q) ||
          (tenant.slug || '').toLowerCase().includes(q)
      );
    }
    if (sortField) {
      items = [...items].sort((a, b) => {
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
  }, [tenants.items, search, sortField, sortDir]);

  const columns = useMemo(() => [
    {
      key: 'name',
      label: t('admin.tenant'),
      sortable: true,
      render: (val) => <span className="font-medium app-text">{val}</span>,
    },
    {
      key: 'name_ar',
      label: t('admin.nameAr'),
      hiddenBelow: 'lg',
      render: (val) => <span className="app-muted" dir="auto">{val || '\u2014'}</span>,
    },
    {
      key: 'slug',
      label: t('admin.slug'),
      hiddenBelow: 'lg',
      render: (val) => <span className="app-muted font-mono text-xs">{val}</span>,
    },
    {
      key: 'plan',
      label: t('admin.plan'),
      hiddenBelow: 'sm',
      sortable: true,
      render: (val) => (
        <Badge color={val === 'enterprise' ? 'purple' : val === 'pro' ? 'blue' : 'slate'}>
          {t(`status.${val}`)}
        </Badge>
      ),
    },
    {
      key: 'user_count',
      label: t('admin.usersCount'),
      hiddenBelow: 'sm',
      sortable: true,
      render: (val) => <span className="app-text tabular-nums">{formatNumber(val)}</span>,
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
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={() => onEdit(row)}
        className="p-1.5 rounded-lg btn-ghost transition-colors focus-ring"
        aria-label={`${t('common.edit')} ${row.name}`}
      >
        <Pencil size={14} />
      </button>
      <button
        onClick={() => onDelete(row.id)}
        className="p-1.5 rounded-lg btn-ghost transition-colors focus-ring"
        aria-label={`${t('common.delete')} ${row.name}`}
      >
        <Trash2 size={14} />
      </button>
    </div>
  ), [onEdit, onDelete, t]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-base font-semibold app-title">
          {t('admin.tenantOrganizations', { count: formatNumber(tenants.total) })}
        </h3>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 app-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('admin.searchTenants')}
              className="ps-9 pe-3 py-1.5 rounded-lg text-sm input-surface w-52"
              aria-label={t('admin.searchTenants')}
            />
          </div>
          <button
            onClick={onNew}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg btn-primary text-sm font-medium focus-ring"
          >
            <Plus size={14} /> {t('admin.newTenant')}
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        totalCount={search ? filtered.length : tenants.total}
        page={search ? 1 : page}
        pageSize={pageSize}
        onPageChange={search ? undefined : onPageChange}
        sortField={sortField}
        sortDir={sortDir}
        onSort={handleSort}
        isLoading={isLoading}
        emptyIcon={Building2}
        emptyTitle={t('admin.noTenantsFound')}
        actions={actions}
        ariaLabel={t('admin.tenants')}
      />
    </div>
  );
};

export default TenantsTab;
