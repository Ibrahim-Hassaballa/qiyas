import { useState, useCallback, useRef, useEffect } from 'react';
import api from '../Services/api';
import { useToast } from '../Components/Toast';
import { useLocale } from '../Context/LocaleContext';

const DEFAULT_PAGE_SIZE = 25;

const initialTabLoading = {};
const initialTabError = {};

/**
 * Centralized admin data fetching + mutations hook.
 * Owns all data, loading, error, pagination, and filter state.
 */
export default function useAdminData(activeTab) {
  const { showToast } = useToast();
  const { t } = useLocale();

  // --- Data state ---
  const [analytics, setAnalytics] = useState(null);
  const [tenants, setTenants] = useState({ items: [], total: 0 });
  const [users, setUsers] = useState({ items: [], total: 0 });
  const [health, setHealth] = useState(null);
  const [logs, setLogs] = useState({ logs: [] });
  const [controls, setControls] = useState([]);
  const [tenantSettings, setTenantSettings] = useState({
    context_memory_enabled: true,
    model_provider: 'azure',
    groq_model: '',
    system_prompt: '',
    topic_guard_prompt: '',
  });
  const [savedSettings, setSavedSettings] = useState(null);

  // --- Per-tab loading / error ---
  const [tabLoading, setTabLoading] = useState(initialTabLoading);
  const [tabError, setTabError] = useState(initialTabError);

  // --- Filters ---
  const [logLevel, setLogLevel] = useState('');
  const [userTenantFilter, setUserTenantFilter] = useState('');

  // --- Pagination ---
  const [tenantsPage, setTenantsPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);

  // --- Mutation loading ---
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // --- Abort controllers per tab ---
  const abortRefs = useRef({});
  const mountedRef = useRef(true);

  useEffect(() => {
    const refs = abortRefs;
    return () => {
      mountedRef.current = false;
      Object.values(refs.current).forEach((ctrl) => ctrl?.abort());
    };
  }, []);

  // --- Safe state setters ---
  const safeSet = useCallback((setter) => (...args) => {
    if (mountedRef.current) setter(...args);
  }, []);

  // --- Fetch helper ---
  const fetchTab = useCallback(async (tabName, fetchFn) => {
    // Cancel previous request for this tab
    abortRefs.current[tabName]?.abort();
    const controller = new AbortController();
    abortRefs.current[tabName] = controller;

    setTabLoading((prev) => ({ ...prev, [tabName]: true }));
    setTabError((prev) => ({ ...prev, [tabName]: null }));

    try {
      await fetchFn(controller.signal);
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'CanceledError') return;
      if (mountedRef.current) {
        const msg = err.response?.status === 403
          ? t('admin.accessDenied')
          : err.response?.data?.message || err.message;
        setTabError((prev) => ({ ...prev, [tabName]: msg }));
      }
    } finally {
      if (mountedRef.current) {
        setTabLoading((prev) => ({ ...prev, [tabName]: false }));
      }
    }
  }, [t]);

  // --- Refresh a specific tab ---
  const refreshTab = useCallback(async (tab) => {
    const target = tab || activeTab;

    switch (target) {
      case 'overview':
        return fetchTab('overview', async (signal) => {
          const res = await api.get('/admin/analytics', { signal });
          safeSet(setAnalytics)(res.data);
        });
      case 'tenants':
        return fetchTab('tenants', async (signal) => {
          const skip = (tenantsPage - 1) * DEFAULT_PAGE_SIZE;
          const res = await api.get(`/admin/tenants?skip=${skip}&limit=${DEFAULT_PAGE_SIZE}`, { signal });
          safeSet(setTenants)(res.data);
        });
      case 'users':
        return fetchTab('users', async (signal) => {
          const skip = (usersPage - 1) * DEFAULT_PAGE_SIZE;
          const q = new URLSearchParams({ skip, limit: DEFAULT_PAGE_SIZE });
          if (userTenantFilter) q.set('tenant_id', userTenantFilter);
          const [usersRes, tenantsRes] = await Promise.all([
            api.get(`/admin/users?${q}`, { signal }),
            api.get('/admin/tenants?skip=0&limit=100', { signal }),
          ]);
          safeSet(setUsers)(usersRes.data);
          safeSet(setTenants)(tenantsRes.data);
        });
      case 'health':
        return fetchTab('health', async (signal) => {
          const res = await api.get('/admin/health', { signal });
          safeSet(setHealth)(res.data);
        });
      case 'logs':
        return fetchTab('logs', async (signal) => {
          const q = logLevel ? `?level=${logLevel}` : '';
          const res = await api.get(`/admin/logs${q}`, { signal });
          safeSet(setLogs)(res.data);
        });
      case 'ai-model':
      case 'prompts':
        return fetchTab(target, async (signal) => {
          const res = await api.get('/settings', { signal });
          safeSet(setTenantSettings)(res.data);
          safeSet(setSavedSettings)(res.data);
        });
      case 'knowledge-base':
        return fetchTab('knowledge-base', async (signal) => {
          const res = await api.get('/controls/controls', { signal });
          safeSet(setControls)(res.data.files || []);
        });
      default:
        break;
    }
  }, [activeTab, fetchTab, safeSet, tenantsPage, usersPage, logLevel, userTenantFilter]);

  // --- Auto-fetch on tab change ---
  useEffect(() => {
    refreshTab();
  }, [refreshTab]);

  // Reset pagination when filters change
  useEffect(() => { setUsersPage(1); }, [userTenantFilter]);

  // --- Mutations ---
  const saveTenant = useCallback(async (formData, existingId) => {
    try {
      if (existingId) {
        await api.put(`/admin/tenants/${existingId}`, formData);
      } else {
        await api.post('/admin/tenants', formData);
      }
      refreshTab('tenants');
      return true;
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
      return false;
    }
  }, [refreshTab, showToast]);

  const deleteTenant = useCallback(async (id) => {
    try {
      await api.delete(`/admin/tenants/${id}`);
      refreshTab('tenants');
      return true;
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
      return false;
    }
  }, [refreshTab, showToast]);

  const saveUser = useCallback(async (formData, existingId) => {
    try {
      if (existingId) {
        await api.put(`/admin/users/${existingId}`, formData);
      } else {
        await api.post('/admin/users', formData);
      }
      refreshTab('users');
      return true;
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
      return false;
    }
  }, [refreshTab, showToast]);

  const deleteUser = useCallback(async (id) => {
    try {
      await api.delete(`/admin/users/${id}`);
      refreshTab('users');
      return true;
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
      return false;
    }
  }, [refreshTab, showToast]);

  const resetPassword = useCallback(async (userId, newPassword) => {
    try {
      await api.post(`/admin/users/${userId}/reset-password`, { new_password: newPassword });
      showToast(t('admin.passwordResetSuccess'), 'success');
      return true;
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
      return false;
    }
  }, [showToast, t]);

  const resetTokens = useCallback(async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/reset-tokens`);
      refreshTab('users');
      return true;
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
      return false;
    }
  }, [refreshTab, showToast]);

  const fetchUsageHistory = useCallback(async (userId) => {
    try {
      const res = await api.get(`/admin/users/${userId}/usage-history`);
      return res.data;
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
      return null;
    }
  }, [showToast]);

  const handleSettingsChange = useCallback((partial) => {
    setTenantSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const saveSettings = useCallback(async () => {
    setIsSavingSettings(true);
    try {
      await api.post('/settings', tenantSettings);
      setSavedSettings({ ...tenantSettings });
      showToast(t('toast.settingsSaved'), 'success');
      return true;
    } catch (err) {
      showToast(err.response?.data?.detail || t('toast.settingsFailed'), 'error');
      return false;
    } finally {
      setIsSavingSettings(false);
    }
  }, [tenantSettings, showToast, t]);

  const uploadControl = useCallback(async (file) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post('/controls/controls/upload', formData, {
        headers: { 'Content-Type': undefined },
      });
      refreshTab('knowledge-base');
      showToast(t('toast.uploadSuccess', { name: file.name }), 'success');
      return true;
    } catch (err) {
      showToast(err.response?.data?.detail || t('toast.uploadFailed'), 'error');
      return false;
    } finally {
      setIsUploading(false);
    }
  }, [refreshTab, showToast, t]);

  const deleteControl = useCallback(async (filename) => {
    try {
      await api.delete(`/controls/controls/${filename}`);
      refreshTab('knowledge-base');
      showToast(t('toast.deleteSuccess', { name: filename }), 'success');
      return true;
    } catch (err) {
      showToast(err.response?.data?.detail || t('toast.deleteFailed'), 'error');
      return false;
    }
  }, [refreshTab, showToast, t]);

  return {
    // Data
    analytics,
    tenants,
    users,
    health,
    logs,
    controls,
    tenantSettings,
    savedSettings,
    // Loading / Error
    tabLoading,
    tabError,
    isLoading: !!tabLoading[activeTab],
    error: tabError[activeTab] || null,
    // Filters
    logLevel,
    setLogLevel,
    userTenantFilter,
    setUserTenantFilter,
    // Pagination
    tenantsPage,
    setTenantsPage,
    usersPage,
    setUsersPage,
    pageSize: DEFAULT_PAGE_SIZE,
    // Mutations
    saveTenant,
    deleteTenant,
    saveUser,
    deleteUser,
    resetPassword,
    resetTokens,
    fetchUsageHistory,
    handleSettingsChange,
    saveSettings,
    isSavingSettings,
    uploadControl,
    deleteControl,
    isUploading,
    // Refresh
    refreshTab,
  };
}
