import { Link } from 'react-router-dom';
import { BarChart3, Building2, Users, Server, FileText, Cpu, Database, AlignLeft, X } from 'lucide-react';
import { useLocale } from '../../Context/LocaleContext';
import { useAuth } from '../../Context/AuthContext';
import UserProfileMenu from '../UserProfileMenu';

const NAV_ITEMS = [
  { id: 'overview', label: 'admin.overview', icon: BarChart3 },
  { id: 'tenants', label: 'admin.tenants', icon: Building2 },
  { id: 'users', label: 'admin.users', icon: Users },
  { id: 'health', label: 'admin.systemHealth', icon: Server },
  { id: 'logs', label: 'admin.logs', icon: FileText },
  { id: 'separator' },
  { id: 'ai-model', label: 'admin.aiModel', icon: Cpu },
  { id: 'knowledge-base', label: 'admin.knowledgeBase', icon: Database },
  { id: 'prompts', label: 'admin.prompts', icon: AlignLeft },
];

const AdminSidebar = ({ activeTab, onTabChange, user, isOpen, onClose, onOpenSettings, collapsed }) => {
  const { t, dir } = useLocale();
  const { logout } = useAuth();

  const renderNavItems = (showLabels = true) => (
    <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto custom-scrollbar" aria-label={t('admin.overview')}>
      {NAV_ITEMS.map((item) => {
        if (item.id === 'separator') {
          return <hr key="sep" className="my-2 app-border" />;
        }
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => {
              onTabChange(item.id);
              onClose?.();
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus-ring ${
              isActive ? 'status-info' : 'btn-ghost'
            } ${!showLabels ? 'justify-center' : ''}`}
            aria-current={isActive ? 'page' : undefined}
            title={!showLabels ? t(item.label) : undefined}
          >
            <item.icon size={16} className="shrink-0" />
            {showLabels && <span className="truncate">{t(item.label)}</span>}
          </button>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar — full or collapsed */}
      <div
        className={`hidden lg:flex flex-col h-full shrink-0 bg-[var(--surface-panel)] ${
          dir === 'rtl' ? 'border-l' : 'border-r'
        } border-[var(--border-primary)] sidebar-transition ${collapsed ? 'w-16' : 'w-60'}`}
      >
        {renderNavItems(!collapsed)}
        <UserProfileMenu user={user} logout={logout} onOpenSettings={onOpenSettings} collapsed={collapsed} />
      </div>

      {/* Mobile overlay sidebar */}
      {isOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
          <div className={`absolute inset-y-0 w-60 z-50 animate-inline-panel ${dir === 'rtl' ? 'right-0' : 'left-0'}`}>
            <div className="flex flex-col h-full app-surface">
              <div className="h-14 flex items-center gap-3 px-4 border-b app-border shrink-0">
                <Link
                  to="/"
                  onClick={onClose}
                  className="flex items-center gap-3 hover:bg-[var(--surface-subtle)] rounded-lg p-1 -m-1 transition-colors"
                  aria-label={t('admin.backToChat')}
                >
                  <div className="w-8 h-8 rounded-lg btn-primary flex items-center justify-center">
                    <span className="text-white font-bold text-sm">Q</span>
                  </div>
                  <span className="text-sm font-semibold app-title">{t('common.adminName')}</span>
                </Link>
                <button onClick={onClose} className="ms-auto p-1.5 rounded-lg btn-ghost transition-colors focus-ring" aria-label={t('common.close')}>
                  <X size={18} />
                </button>
              </div>
              {renderNavItems(true)}
              <UserProfileMenu user={user} logout={logout} onOpenSettings={onOpenSettings} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminSidebar;
