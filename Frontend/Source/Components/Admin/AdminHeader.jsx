import { useNavigate } from 'react-router-dom';
import { RotateCcw, Menu, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useLocale } from '../../Context/LocaleContext';

const TITLES = {
  overview: 'admin.overview',
  tenants: 'admin.tenants',
  users: 'admin.users',
  health: 'admin.systemHealth',
  logs: 'admin.logs',
  'ai-model': 'admin.aiModel',
  'knowledge-base': 'admin.knowledgeBase',
  prompts: 'admin.prompts',
};

const AdminHeader = ({ activeTab, loading, onRefresh, onMenuToggle, sidebarCollapsed, onToggleCollapse }) => {
  const navigate = useNavigate();
  const { t, dir } = useLocale();

  return (
    <header className="h-14 border-b border-[var(--border-primary)] bg-[var(--surface-panel)] flex items-center shrink-0 transition-colors">
      {/* Logo area — syncs width with sidebar */}
      <div
        className={`hidden lg:flex items-center justify-center shrink-0 h-full ${
          dir === 'rtl' ? 'border-l' : 'border-r'
        } border-[var(--border-primary)] header-section-transition overflow-hidden`}
        style={{ width: sidebarCollapsed ? '4rem' : '15rem' }}
      >
        {sidebarCollapsed ? (
          <button
            onClick={onToggleCollapse}
            aria-label={t('admin.expandMenu')}
            className="flex items-center justify-center w-full h-full hover:bg-[var(--surface-subtle)] transition-colors cursor-pointer focus-ring"
          >
            <PanelLeftOpen size={20} className="app-muted flip-rtl" />
          </button>
        ) : (
          <>
            <button
              onClick={() => navigate('/')}
              aria-label={t('admin.backToChat')}
              className="flex items-center gap-3 px-4 h-full hover:bg-[var(--surface-subtle)] transition-colors cursor-pointer focus-ring shrink-0"
            >
              <div className="w-8 h-8 rounded-lg btn-primary flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">Q</span>
              </div>
              <span className="text-sm font-semibold app-title whitespace-nowrap">{t('common.adminName')}</span>
            </button>
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg btn-ghost ms-auto me-2 hidden lg:flex focus-ring"
              aria-label={t('admin.collapseMenu')}
            >
              <PanelLeftClose size={18} className="flip-rtl" />
            </button>
          </>
        )}
      </div>

      <div className="flex-1 flex items-center gap-3 px-4 min-w-0">
        {/* Mobile hamburger */}
        <button onClick={onMenuToggle} className="p-1.5 rounded-lg btn-ghost transition-colors lg:hidden focus-ring" aria-label={t('common.menu')}>
          <Menu size={18} />
        </button>

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm min-w-0 flex-1" aria-label="Breadcrumb">
          <span className="app-muted font-medium hidden sm:inline">{t('admin.breadcrumbAdmin')}</span>
          <ChevronRight size={12} className="app-muted shrink-0 hidden sm:block flip-rtl" />
          <span className="font-semibold app-title truncate">{t(TITLES[activeTab] || 'admin.overview')}</span>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm btn-secondary transition-colors focus-ring"
            aria-label={t('common.refresh')}
          >
            <RotateCcw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{t('common.refresh')}</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
