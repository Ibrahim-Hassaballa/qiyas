import { useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

const VALID_ACTIONS = new Set([
  'new-tenant', 'edit-tenant', 'new-user', 'edit-user', 'reset-password', 'usage-history',
]);

/**
 * Unified modal state synced with URL search params.
 * URL is the single source of truth.
 */
export default function useModal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const triggerRef = useRef(null);

  const action = searchParams.get('action');
  const id = searchParams.get('id');

  const modalType = useMemo(() => {
    return action && VALID_ACTIONS.has(action) ? action : null;
  }, [action]);

  const isOpen = !!modalType;

  const open = useCallback((type, entityId) => {
    triggerRef.current = document.activeElement;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('action', type);
      if (entityId) next.set('id', entityId);
      else next.delete('id');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const close = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('action');
      next.delete('id');
      return next;
    }, { replace: true });
    // Return focus to trigger
    if (triggerRef.current && typeof triggerRef.current.focus === 'function') {
      setTimeout(() => triggerRef.current?.focus(), 50);
    }
  }, [setSearchParams]);

  // Update active tab helper (preserves other params)
  const setActiveTab = useCallback((tab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'overview') next.delete('tab');
      else next.set('tab', tab);
      // Close any open modals on tab switch
      next.delete('action');
      next.delete('id');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const activeTab = useMemo(() => {
    const tab = searchParams.get('tab');
    const VALID_TABS = new Set([
      'overview', 'tenants', 'users', 'health', 'logs',
      'ai-model', 'knowledge-base', 'prompts',
    ]);
    return tab && VALID_TABS.has(tab) ? tab : 'overview';
  }, [searchParams]);

  return {
    isOpen,
    modalType,
    modalId: id,
    activeTab,
    open,
    close,
    setActiveTab,
    searchParams,
  };
}
