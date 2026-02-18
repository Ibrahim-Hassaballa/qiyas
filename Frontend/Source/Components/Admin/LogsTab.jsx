import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, Copy, Check, FileText } from 'lucide-react';
import { useLocale } from '../../Context/LocaleContext';
import Badge from './Shared/Badge';
import EmptyState from './Shared/EmptyState';

const LEVELS = ['', 'DEBUG', 'INFO', 'WARNING', 'ERROR'];

const levelBadgeColor = {
  ERROR: 'red',
  WARNING: 'amber',
  INFO: 'blue',
  DEBUG: 'slate',
};

const levelBgColor = {
  ERROR: 'bg-[var(--danger-soft)]',
  WARNING: 'bg-[var(--warning-soft)]',
};

const LogEntry = ({ entry, index, formatDate, t }) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e) => {
    e.stopPropagation();
    const text = entry.raw || `${entry.level} ${entry.timestamp || ''} ${entry.message}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API not available
    }
  }, [entry]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') setExpanded((prev) => !prev);
  }, []);

  if (entry.raw) {
    return (
      <div className="px-4 py-1.5 border-b app-border hover:bg-[var(--surface-panel)] transition-colors group">
        <div className="flex items-start gap-2">
          <span className="text-[10px] app-muted tabular-nums select-none w-8 text-end shrink-0 pt-0.5">{index + 1}</span>
          <span className="app-muted flex-1">{entry.raw}</span>
          <button
            onClick={handleCopy}
            className="opacity-0 group-hover:opacity-100 p-1 rounded btn-ghost transition-opacity focus-ring shrink-0"
            aria-label={t('admin.copyLogEntry')}
          >
            {copied ? <Check size={12} className="text-[var(--success-500)]" /> : <Copy size={12} />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`px-4 py-1.5 border-b app-border hover:bg-[var(--surface-panel)] transition-colors cursor-pointer group ${levelBgColor[entry.level] || ''}`}
      onClick={() => setExpanded((prev) => !prev)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-expanded={expanded}
    >
      <div className="flex items-start gap-2">
        <span className="text-[10px] app-muted tabular-nums select-none w-8 text-end shrink-0 pt-0.5">{index + 1}</span>
        <span className="shrink-0 mt-px">
          <Badge color={levelBadgeColor[entry.level] || 'slate'} size="sm">
            {entry.level?.padEnd(7)}
          </Badge>
        </span>
        <span className="app-muted shrink-0 tabular-nums text-[11px] pt-px">
          {entry.timestamp ? formatDate(entry.timestamp, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
        </span>
        <span className={`app-text flex-1 ${expanded ? '' : 'line-clamp-1'}`}>
          {entry.message}
        </span>
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 p-1 rounded btn-ghost transition-opacity focus-ring shrink-0"
          aria-label={t('admin.copyLogEntry')}
        >
          {copied ? <Check size={12} className="text-[var(--success-500)]" /> : <Copy size={12} />}
        </button>
      </div>
    </div>
  );
};

const LogsTab = ({ logs, logLevel, onLogLevelChange, onRefresh, isLoading = false }) => {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [searchText, setSearchText] = useState('');
  const intervalRef = useRef(null);
  const { t, formatDate } = useLocale();

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => onRefresh(), 5000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, onRefresh]);

  const entries = useMemo(() => {
    let items = logs.logs || [];
    if (searchText) {
      const q = searchText.toLowerCase();
      items = items.filter((entry) =>
        (entry.message || '').toLowerCase().includes(q) ||
        (entry.raw || '').toLowerCase().includes(q)
      );
    }
    return items;
  }, [logs.logs, searchText]);

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      {/* Sticky toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold app-title">{t('admin.applicationLogs')}</h3>
          {entries.length > 0 && <span className="text-xs app-muted">{t('admin.entriesCount', { count: entries.length })}</span>}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 app-muted" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={t('admin.searchLogs')}
              className="ps-9 pe-3 py-1.5 rounded-lg text-sm input-surface w-48"
              aria-label={t('admin.searchLogs')}
            />
          </div>

          {/* Level filter buttons */}
          <div className="flex items-center gap-1">
            {LEVELS.map((level) => (
              <button
                key={level}
                onClick={() => onLogLevelChange(level)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors focus-ring ${
                  logLevel === level ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                {level || t('common.all')}
              </button>
            ))}
          </div>

          {/* Auto-refresh */}
          <label className="flex items-center gap-2 cursor-pointer text-xs app-text">
            {autoRefresh && (
              <span className="w-2 h-2 rounded-full bg-[var(--success-500)] pulse-dot" aria-hidden="true" />
            )}
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border app-border"
            />
            {t('admin.autoRefresh')}
            {autoRefresh && (
              <span className="sr-only" aria-live="polite">{t('admin.liveUpdating')}</span>
            )}
          </label>
        </div>
      </div>

      {/* Log entries */}
      <div className="app-surface-subtle rounded-lg overflow-hidden flex-1 min-h-0">
        <div className="h-full overflow-y-auto custom-scrollbar font-mono text-xs leading-5">
          {isLoading && entries.length === 0 ? (
            <div className="space-y-0">
              {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className="px-4 py-2 border-b app-border">
                  <div className="flex gap-3">
                    <div className="h-3 w-8 rounded skeleton" />
                    <div className="h-3 w-14 rounded skeleton" />
                    <div className="h-3 w-16 rounded skeleton" />
                    <div className="h-3 flex-1 rounded skeleton" />
                  </div>
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={t('admin.noLogEntries')}
              description={searchText ? t('admin.searchLogs') : undefined}
            />
          ) : (
            entries.map((entry, i) => (
              <LogEntry key={i} entry={entry} index={i} formatDate={formatDate} t={t} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default LogsTab;
