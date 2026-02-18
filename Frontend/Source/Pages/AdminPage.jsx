import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../Context/AuthContext';
import { useLocale } from '../Context/LocaleContext';
import { useTheme } from '../Context/ThemeContext';
import DeleteConfirmModal from '../Components/DeleteConfirmModal';
import SettingsModal from '../Components/SettingsModal';
import useAdminData from '../Hooks/useAdminData';
import useModal from '../Hooks/useModal';

import AdminSidebar from '../Components/Admin/AdminSidebar';
import AdminHeader from '../Components/Admin/AdminHeader';
import AdminErrorBoundary from '../Components/Admin/Shared/AdminErrorBoundary';
import OverviewTab from '../Components/Admin/OverviewTab';
import TenantsTab from '../Components/Admin/TenantsTab';
import UsersTab from '../Components/Admin/UsersTab';
import HealthTab from '../Components/Admin/HealthTab';
import LogsTab from '../Components/Admin/LogsTab';
import AIModelTab from '../Components/Admin/AIModelTab';
import KnowledgeBaseTab from '../Components/Admin/KnowledgeBaseTab';
import PromptsTab from '../Components/Admin/PromptsTab';

import TenantModal from '../Components/Admin/Modals/TenantModal';
import UserModal from '../Components/Admin/Modals/UserModal';
import PasswordModal from '../Components/Admin/Modals/PasswordModal';
import UsageHistoryModal from '../Components/Admin/Modals/UsageHistoryModal';

import { AlertTriangle } from 'lucide-react';

const VALID_TABS = new Set(['overview', 'tenants', 'users', 'health', 'logs', 'ai-model', 'knowledge-base', 'prompts']);

const AdminPage = () => {
  const { user } = useAuth();
  const { t } = useLocale();
  const { theme, setTheme } = useTheme();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('admin-sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const toggleSidebarCollapse = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('admin-sidebar-collapsed', String(next));
      } catch { /* localStorage unavailable */ }
      return next;
    });
  }, []);
  const [confirmAction, setConfirmAction] = useState(null);

  // Modal local state
  const [editingTenant, setEditingTenant] = useState(null);
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [passwordUserId, setPasswordUserId] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showUsageHistoryModal, setShowUsageHistoryModal] = useState(false);
  const [usageHistory, setUsageHistory] = useState({ user_id: null, resets: [] });
  const [historyUser, setHistoryUser] = useState(null);

  // Sort state for users
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  // Tab routing
  const activeTab = useMemo(() => {
    const tab = searchParams.get('tab');
    return tab && VALID_TABS.has(tab) ? tab : 'overview';
  }, [searchParams]);

  const updateParams = useCallback((updates) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([k, v]) => {
        if (v === null || v === undefined) next.delete(k);
        else next.set(k, v);
      });
      if (next.get('tab') === 'overview') next.delete('tab');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setActiveTab = useCallback((tab) => {
    updateParams({ tab: tab === 'overview' ? null : tab, action: null, id: null });
  }, [updateParams]);

  // Modal URL syncing
  const modal = useModal();

  // Centralized data — auto-fetches on activeTab change
  const admin = useAdminData(activeTab);

  // Modal restoration from URL
  const modalRestored = useRef(false);
  useEffect(() => {
    if (modalRestored.current || admin.isLoading) return;
    if (!modal.modalType) { modalRestored.current = true; return; }

    switch (modal.modalType) {
      case 'new-tenant':
        setEditingTenant(null); setShowTenantModal(true); modalRestored.current = true; break;
      case 'edit-tenant':
        if (modal.modalId && admin.tenants.items.length > 0) {
          const found = admin.tenants.items.find((item) => item.id === modal.modalId);
          if (found) { setEditingTenant(found); setShowTenantModal(true); }
          modalRestored.current = true;
        }
        break;
      case 'new-user':
        if (admin.tenants.items.length > 0) { setEditingUser(null); setShowUserModal(true); modalRestored.current = true; }
        break;
      case 'edit-user':
        if (modal.modalId && admin.users.items.length > 0) {
          const found = admin.users.items.find((item) => item.id === modal.modalId);
          if (found) { setEditingUser(found); setShowUserModal(true); }
          modalRestored.current = true;
        }
        break;
      case 'reset-password':
        if (modal.modalId) { setPasswordUserId(modal.modalId); setShowPasswordModal(true); modalRestored.current = true; }
        break;
      case 'usage-history':
        if (modal.modalId && admin.users.items.length > 0) {
          const found = admin.users.items.find((item) => item.id === modal.modalId);
          if (found) {
            admin.fetchUsageHistory(modal.modalId).then((data) => {
              if (data) { setUsageHistory(data); setHistoryUser(found.username); setShowUsageHistoryModal(true); }
            });
          }
          modalRestored.current = true;
        }
        break;
    }
  }, [admin.isLoading, modal.modalType, modal.modalId, admin.tenants.items, admin.users.items, admin.fetchUsageHistory]);

  // Handlers
  const handleSaveTenant = useCallback(async (formData) => {
    const ok = await admin.saveTenant(formData, editingTenant?.id);
    if (ok) { setShowTenantModal(false); setEditingTenant(null); modal.close(); }
  }, [admin, editingTenant, modal]);

  const handleDeleteTenant = useCallback((id) => {
    setConfirmAction({
      title: t('admin.deactivateTenantTitle'),
      message: t('admin.deactivateTenantMessage'),
      onConfirm: () => admin.deleteTenant(id),
    });
  }, [admin, t]);

  const handleSaveUser = useCallback(async (formData) => {
    const ok = await admin.saveUser(formData, editingUser?.id);
    if (ok) { setShowUserModal(false); setEditingUser(null); modal.close(); }
  }, [admin, editingUser, modal]);

  const handleDeleteUser = useCallback((id) => {
    setConfirmAction({
      title: t('admin.deactivateUserTitle'),
      message: t('admin.deactivateUserMessage'),
      onConfirm: () => admin.deleteUser(id),
    });
  }, [admin, t]);

  const handleResetPassword = useCallback(async (newPassword) => {
    const ok = await admin.resetPassword(passwordUserId, newPassword);
    if (ok) { setShowPasswordModal(false); setPasswordUserId(null); modal.close(); }
  }, [admin, passwordUserId, modal]);

  const handleResetTokens = useCallback((targetUser) => {
    setConfirmAction({
      title: t('admin.resetTokenUsageTitle'),
      message: t('admin.resetTokenUsageMessage', { username: targetUser.username }),
      onConfirm: () => admin.resetTokens(targetUser.id),
    });
  }, [admin, t]);

  const handleViewHistory = useCallback(async (userId, username) => {
    const data = await admin.fetchUsageHistory(userId);
    if (data) { setUsageHistory(data); setHistoryUser(username); setShowUsageHistoryModal(true); }
  }, [admin]);

  const handleUploadControl = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await admin.uploadControl(file);
    e.target.value = '';
  }, [admin]);

  const handleSort = useCallback((field) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }, [sortField]);

  return (
    <div className="flex flex-col h-screen app-shell overflow-hidden font-sans">
      {/* Skip to content */}
      <a href="#admin-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-3 focus:bg-[var(--accent-500)] focus:text-white focus:rounded-lg focus:m-2">
        {t('admin.skipToContent')}
      </a>

      <AdminHeader
        activeTab={activeTab}
        loading={admin.isLoading}
        onRefresh={() => admin.refreshTab(activeTab)}
        onMenuToggle={() => setSidebarOpen(true)}
        sidebarCollapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />

      <div className="flex flex-1 min-h-0">
        <AdminSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          user={user}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          collapsed={sidebarCollapsed}
        />

        <main id="admin-content" className="flex-1 flex flex-col min-w-0 app-shell transition-colors">
          <div className={`flex-1 p-6 ${activeTab === 'logs' ? 'flex flex-col min-h-0 overflow-hidden' : 'overflow-y-auto custom-scrollbar'}`}>
            {admin.error && (
              <div className="mb-6 px-4 py-3 rounded-lg status-danger text-sm flex items-center gap-2" role="alert">
                <AlertTriangle size={16} /> {admin.error}
              </div>
            )}

            <AdminErrorBoundary key={activeTab} onRetry={() => admin.refreshTab(activeTab)} t={t}
              className={activeTab === 'logs' ? 'flex-1 min-h-0 flex flex-col' : undefined}>
              {activeTab === 'overview' && (
                <OverviewTab analytics={admin.analytics} isLoading={admin.isLoading} />
              )}

              {activeTab === 'tenants' && (
                <TenantsTab
                  tenants={admin.tenants}
                  page={admin.tenantsPage}
                  pageSize={admin.pageSize}
                  onPageChange={admin.setTenantsPage}
                  isLoading={admin.isLoading}
                  onNew={() => { setEditingTenant(null); setShowTenantModal(true); modal.open('new-tenant'); }}
                  onEdit={(tenant) => { setEditingTenant(tenant); setShowTenantModal(true); modal.open('edit-tenant', tenant.id); }}
                  onDelete={handleDeleteTenant}
                />
              )}

              {activeTab === 'users' && (
                <UsersTab
                  users={admin.users}
                  tenants={admin.tenants.items}
                  userTenantFilter={admin.userTenantFilter}
                  onTenantFilterChange={admin.setUserTenantFilter}
                  page={admin.usersPage}
                  pageSize={admin.pageSize}
                  onPageChange={admin.setUsersPage}
                  sortField={sortField}
                  sortDir={sortDir}
                  onSort={handleSort}
                  isLoading={admin.isLoading}
                  onNew={() => { setEditingUser(null); setShowUserModal(true); modal.open('new-user'); }}
                  onEdit={(u) => { setEditingUser(u); setShowUserModal(true); modal.open('edit-user', u.id); }}
                  onDelete={handleDeleteUser}
                  onResetPassword={(id) => { setPasswordUserId(id); setShowPasswordModal(true); modal.open('reset-password', id); }}
                  onResetTokens={handleResetTokens}
                  onViewHistory={(id, username) => { handleViewHistory(id, username); modal.open('usage-history', id); }}
                />
              )}

              {activeTab === 'health' && (
                <HealthTab health={admin.health} isLoading={admin.isLoading} />
              )}

              {activeTab === 'logs' && (
                <LogsTab
                  logs={admin.logs}
                  logLevel={admin.logLevel}
                  onLogLevelChange={admin.setLogLevel}
                  onRefresh={() => admin.refreshTab('logs')}
                  isLoading={admin.isLoading}
                />
              )}

              {activeTab === 'ai-model' && (
                <AIModelTab
                  tenantSettings={admin.tenantSettings}
                  savedSettings={admin.savedSettings}
                  onSettingsChange={admin.handleSettingsChange}
                  onSaveSettings={admin.saveSettings}
                  isSavingSettings={admin.isSavingSettings}
                  isLoading={admin.isLoading}
                />
              )}

              {activeTab === 'knowledge-base' && (
                <KnowledgeBaseTab
                  controls={admin.controls}
                  onUploadControl={handleUploadControl}
                  onDeleteControl={admin.deleteControl}
                  isUploading={admin.isUploading}
                  isLoading={admin.isLoading}
                />
              )}

              {activeTab === 'prompts' && (
                <PromptsTab
                  tenantSettings={admin.tenantSettings}
                  savedSettings={admin.savedSettings}
                  onSettingsChange={admin.handleSettingsChange}
                  onSaveSettings={admin.saveSettings}
                  isSavingSettings={admin.isSavingSettings}
                  isLoading={admin.isLoading}
                />
              )}
            </AdminErrorBoundary>
          </div>
        </main>
      </div>

      {/* Modals */}
      {showTenantModal && (
        <TenantModal
          tenant={editingTenant}
          onSave={handleSaveTenant}
          onClose={() => { setShowTenantModal(false); setEditingTenant(null); modal.close(); }}
        />
      )}
      {showUserModal && (
        <UserModal
          user={editingUser}
          tenants={admin.tenants.items}
          onSave={handleSaveUser}
          onClose={() => { setShowUserModal(false); setEditingUser(null); modal.close(); }}
        />
      )}
      {showPasswordModal && (
        <PasswordModal
          onSave={handleResetPassword}
          onClose={() => { setShowPasswordModal(false); setPasswordUserId(null); modal.close(); }}
        />
      )}
      {showUsageHistoryModal && (
        <UsageHistoryModal
          username={historyUser}
          resets={usageHistory.resets || []}
          onClose={() => { setShowUsageHistoryModal(false); setUsageHistory({ user_id: null, resets: [] }); setHistoryUser(null); modal.close(); }}
        />
      )}
      <DeleteConfirmModal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={confirmAction?.onConfirm || (() => {})}
        title={confirmAction?.title || t('admin.confirmDelete')}
        message={confirmAction?.message || t('chat.deleteConversationMessage')}
      />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} theme={theme} setTheme={setTheme} />
    </div>
  );
};

export default AdminPage;
