import { memo, useCallback } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale } from '../../../Context/LocaleContext';
import EmptyState from './EmptyState';

const HIDDEN_CLASSES = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
};

const CARD_HIDDEN_CLASSES = {
  sm: 'hidden sm:flex',
  md: 'hidden md:flex',
  lg: 'hidden lg:flex',
};

const thClass = 'px-5 py-3 text-xs uppercase tracking-wider table-head font-semibold text-start';

// Skeleton row component
const SkeletonRow = memo(({ columnCount }) => (
  <tr>
    {Array.from({ length: columnCount }, (_, i) => (
      <td key={i} className="px-5 py-3">
        <div className="h-4 rounded skeleton w-3/4" />
      </td>
    ))}
  </tr>
));
SkeletonRow.displayName = 'SkeletonRow';

// Skeleton card for mobile
const SkeletonCard = memo(() => (
  <div className="app-surface rounded-lg p-4 space-y-3">
    {Array.from({ length: 3 }, (_, i) => (
      <div key={i} className="flex justify-between">
        <div className="h-3 w-16 rounded skeleton" />
        <div className="h-3 w-24 rounded skeleton" />
      </div>
    ))}
  </div>
));
SkeletonCard.displayName = 'SkeletonCard';

// Pagination controls
const Pagination = memo(({ page, pageSize, totalCount, onPageChange, t, formatNumber }) => {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t app-border">
      <span className="text-xs app-muted">
        {t('admin.showingRange', { from: formatNumber(from), to: formatNumber(to), total: formatNumber(totalCount) })}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-lg btn-ghost transition-colors disabled:opacity-30 focus-ring"
          aria-label={t('admin.previousPage')}
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs app-text px-2 tabular-nums">
          {t('admin.page', { current: formatNumber(page), total: formatNumber(totalPages) })}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg btn-ghost transition-colors disabled:opacity-30 focus-ring"
          aria-label={t('admin.nextPage')}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
});
Pagination.displayName = 'Pagination';

const DataTable = ({
  columns,
  data,
  totalCount = 0,
  page = 1,
  pageSize = 25,
  onPageChange,
  sortField,
  sortDir,
  onSort,
  isLoading = false,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  actions,
  ariaLabel,
  rowKey = 'id',
}) => {
  const { t, formatNumber } = useLocale();

  const visibleCount = columns.length + (actions ? 1 : 0);

  const handleSortClick = useCallback((field) => {
    if (onSort) onSort(field);
  }, [onSort]);

  return (
    <div className="table-shell rounded-lg overflow-hidden">
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm" aria-label={ariaLabel}>
          <thead>
            <tr className="border-b app-border">
              {columns.map((col) => {
                const hidden = col.hiddenBelow ? HIDDEN_CLASSES[col.hiddenBelow] : '';
                const sortable = col.sortable && onSort;
                const isSorted = sortField === col.key;
                return (
                  <th
                    key={col.key}
                    className={`${thClass} ${hidden} ${col.align === 'end' ? 'text-end' : ''} ${sortable ? 'cursor-pointer select-none hover:opacity-80' : ''}`}
                    style={col.width ? { width: col.width } : undefined}
                    onClick={sortable ? () => handleSortClick(col.key) : undefined}
                    scope="col"
                    aria-sort={isSorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    <div className={`flex items-center gap-1 ${col.align === 'end' ? 'justify-end' : ''}`}>
                      {col.label}
                      {isSorted && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </div>
                  </th>
                );
              })}
              {actions && (
                <th className={`${thClass} text-end`} scope="col">{t('common.actions')}</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y app-border">
            {isLoading ? (
              Array.from({ length: pageSize }, (_, i) => (
                <SkeletonRow key={i} columnCount={visibleCount} />
              ))
            ) : data.length > 0 ? (
              data.map((row) => (
                <tr key={row[rowKey]} className="table-row-hover">
                  {columns.map((col) => {
                    const hidden = col.hiddenBelow ? HIDDEN_CLASSES[col.hiddenBelow] : '';
                    return (
                      <td
                        key={col.key}
                        className={`px-5 py-3 ${hidden} ${col.align === 'end' ? 'text-end' : ''}`}
                      >
                        {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '\u2014')}
                      </td>
                    );
                  })}
                  {actions && (
                    <td className="px-5 py-3 text-end">
                      {actions(row)}
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={visibleCount}>
                  <EmptyState
                    icon={emptyIcon}
                    title={emptyTitle}
                    description={emptyDescription}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3 p-3">
        {isLoading ? (
          Array.from({ length: pageSize }, (_, i) => <SkeletonCard key={i} />)
        ) : data.length > 0 ? (
          data.map((row) => (
            <div key={row[rowKey]} className="app-surface rounded-lg p-4 space-y-2">
              {columns.map((col) => (
                <div key={col.key} className={`flex items-center justify-between gap-2 ${col.hiddenBelow ? CARD_HIDDEN_CLASSES[col.hiddenBelow] || '' : ''}`}>
                  <span className="text-xs app-muted shrink-0">{col.label}</span>
                  <span className="text-sm app-text text-end truncate">
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '\u2014')}
                  </span>
                </div>
              ))}
              {actions && (
                <div className="flex items-center justify-end gap-1 pt-2 border-t app-border">
                  {actions(row)}
                </div>
              )}
            </div>
          ))
        ) : (
          <EmptyState
            icon={emptyIcon}
            title={emptyTitle}
            description={emptyDescription}
          />
        )}
      </div>

      {/* Pagination */}
      {totalCount > 0 && onPageChange && (
        <Pagination
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={onPageChange}
          t={t}
          formatNumber={formatNumber}
        />
      )}
    </div>
  );
};

export default memo(DataTable);
