import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Settings, LayoutDashboard, LogOut, ChevronUp } from 'lucide-react';
import { useLocale } from '../Context/LocaleContext';

const UserProfileMenu = ({ user, logout, onOpenSettings, collapsed = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const firstItemRef = useRef(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t, dir, formatNumber } = useLocale();

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const isOnAdmin = pathname.startsWith('/admin');
  const userInitial = user?.username?.charAt(0)?.toUpperCase() || 'U';
  const hasCostLimit = user?.cost_limit > 0;

  const close = useCallback(() => setIsOpen(false), []);

  // Click-outside handler
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) {
        close();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen, close]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        close();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, close]);

  // Focus first menu item on open
  useEffect(() => {
    if (isOpen) {
      // Small delay to let the DOM render
      requestAnimationFrame(() => firstItemRef.current?.focus());
    }
  }, [isOpen]);

  const handleToggle = () => setIsOpen((prev) => !prev);

  // Fixed positioning for popup when collapsed (escapes overflow:hidden)
  const [menuPos, setMenuPos] = useState(null);
  useLayoutEffect(() => {
    if (collapsed && isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPos({
        bottom: window.innerHeight - rect.top + 8,
        ...(dir === 'rtl'
          ? { right: window.innerWidth - rect.right }
          : { left: rect.left }),
      });
    } else {
      setMenuPos(null);
    }
  }, [collapsed, isOpen, dir]);

  const handleAction = (action) => {
    close();
    action();
  };

  // Cost usage calculations
  const costPct = hasCostLimit
    ? Math.min(((user.cost_used || 0) / user.cost_limit) * 100, 100)
    : 0;
  const barFill = costPct >= 90
    ? 'var(--danger-500)' : costPct >= 70
    ? 'var(--warning-500)' : 'var(--accent-500)';
  const barTrack = costPct >= 90
    ? 'var(--danger-bar-track)' : costPct >= 70
    ? 'var(--warning-bar-track)' : 'var(--accent-bar-track)';

  return (
    <div className={`relative ${collapsed ? 'p-2' : 'p-3.5'} border-t app-border shrink-0`}>
      {/* Dropdown menu — positioned above the trigger */}
      <div
        ref={menuRef}
        role="menu"
        aria-label={t('common.profile')}
        className={`${collapsed && menuPos ? 'fixed z-50' : 'absolute bottom-full mb-2'} rounded-xl app-surface-elevated shadow-lg border app-border overflow-hidden transition-all duration-150 origin-bottom ${
          !collapsed ? 'left-0 right-0 mx-2' : ''
        } ${
          collapsed && menuPos ? 'w-56' : ''
        } ${
          isOpen
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-1 pointer-events-none'
        }`}
        style={collapsed && menuPos ? menuPos : undefined}
      >
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
          {/* Usage section */}
          {hasCostLimit && (
            <>
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-medium app-muted">
                    {t('chat.costUsage')}
                  </span>
                  <span className="text-[11px] app-muted tabular-nums">
                    ${formatNumber(user.cost_used || 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {' / '}
                    ${formatNumber(user.cost_limit || 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="flex-1 h-1.5 rounded-full overflow-hidden"
                    style={{ backgroundColor: barTrack }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${costPct}%`, backgroundColor: barFill }}
                    />
                  </div>
                  <span
                    className="text-[10px] font-medium tabular-nums shrink-0"
                    style={{ color: barFill }}
                  >
                    {Math.round(costPct)}%
                  </span>
                </div>
              </div>
              <hr className="app-border" />
            </>
          )}

          {/* Menu items */}
          <div className="py-1">
            <button
              ref={firstItemRef}
              role="menuitem"
              onClick={() => handleAction(() => onOpenSettings?.())}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm app-text hover:bg-[var(--surface-subtle)] transition-colors focus-ring"
            >
              <Settings size={16} className="app-muted shrink-0" />
              <span>{t('chat.settings')}</span>
            </button>

            {isAdmin && !isOnAdmin && (
              <button
                role="menuitem"
                onClick={() => handleAction(() => navigate('/admin'))}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm app-text hover:bg-[var(--surface-subtle)] transition-colors focus-ring"
              >
                <LayoutDashboard size={16} className="app-muted shrink-0" />
                <span>{t('common.dashboard')}</span>
              </button>
            )}
          </div>

          <hr className="app-border" />

          <div className="py-1">
            <button
              role="menuitem"
              onClick={() => handleAction(logout)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--danger-500)] hover:bg-[var(--surface-subtle)] transition-colors focus-ring"
            >
              <LogOut size={16} className="shrink-0" />
              <span>{t('common.signOut')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Trigger — profile card */}
      <button
        ref={triggerRef}
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={`flex items-center rounded-xl hover:bg-[var(--surface-subtle)] transition-colors focus-ring ${
          collapsed ? 'justify-center p-2' : 'w-full gap-3 p-2.5'
        }`}
        title={collapsed ? (user?.username || t('admin.user')) : undefined}
      >
        <div className={`${collapsed ? 'w-9 h-9' : 'w-10 h-10'} rounded-full btn-primary flex items-center justify-center text-white font-semibold text-sm shrink-0`}>
          {userInitial}
        </div>
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0 text-start">
              <p className="text-sm font-medium app-title truncate">{user?.username || t('admin.user')}</p>
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--accent-500)]">
                {t(`status.${user?.role || 'member'}`)}
              </span>
            </div>
            <ChevronUp
              size={16}
              className={`app-muted shrink-0 transition-transform duration-200 ${isOpen ? '' : 'rotate-180'}`}
            />
          </>
        )}
      </button>
    </div>
  );
};

export default UserProfileMenu;
