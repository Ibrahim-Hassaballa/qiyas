import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { MessageSquare, Plus, Search, Trash2, X, MessageCircle } from 'lucide-react';
import { useAuth } from '../Context/AuthContext';
import { useLocale } from '../Context/LocaleContext';
import api from '../Services/api';
import DeleteConfirmModal from './DeleteConfirmModal';
import UserProfileMenu from './UserProfileMenu';

const groupConversationsByDate = (conversations) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups = { today: [], yesterday: [], previous7Days: [], older: [] };

  conversations.forEach((conv) => {
    const date = new Date(conv.created_at);
    if (date >= today) groups.today.push(conv);
    else if (date >= yesterday) groups.yesterday.push(conv);
    else if (date >= weekAgo) groups.previous7Days.push(conv);
    else groups.older.push(conv);
  });

  return Object.entries(groups).filter(([, items]) => items.length > 0);
};

const SidebarSkeleton = () => (
  <div className="px-3 space-y-2">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex items-center gap-3 p-3 rounded-xl">
        <div className="w-5 h-5 rounded skeleton shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 rounded skeleton w-3/4" />
          <div className="h-2.5 rounded skeleton w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

const GROUP_LABELS = {
  today: 'chat.today',
  yesterday: 'chat.yesterday',
  previous7Days: 'chat.previous7Days',
  older: 'chat.older'
};

const ChatSidebar = ({
  onSelectConversation,
  onNewChat,
  activeConversationId,
  refreshTrigger,
  onOpenSettings,
  isSidebarOpen,
  onCloseSidebar,
  isCollapsed,
}) => {
  const { user, logout } = useAuth();
  const { t, dir } = useLocale();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [convToDelete, setConvToDelete] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [chatsOpen, setChatsOpen] = useState(false);
  const chatsBtnRef = useRef(null);
  const chatsPopoverRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const response = await api.get('/history/');
      setConversations(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to fetch conversations', error);
      if (error.response?.status === 401) logout();
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [user, logout]);

  useEffect(() => {
    fetchConversations();
  }, [user, activeConversationId, refreshTrigger, fetchConversations]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && isSidebarOpen) onCloseSidebar?.();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isSidebarOpen, onCloseSidebar]);

  // Close conversations popover on click-outside
  useEffect(() => {
    if (!chatsOpen) return;
    const handle = (e) => {
      if (
        chatsPopoverRef.current && !chatsPopoverRef.current.contains(e.target) &&
        chatsBtnRef.current && !chatsBtnRef.current.contains(e.target)
      ) setChatsOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [chatsOpen]);

  // Close conversations popover on Escape
  useEffect(() => {
    if (!chatsOpen) return;
    const handle = (e) => { if (e.key === 'Escape') setChatsOpen(false); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [chatsOpen]);

  // Close conversations popover when sidebar expands
  useEffect(() => {
    if (!isCollapsed) setChatsOpen(false);
  }, [isCollapsed]);

  const handleDeleteClick = (id) => {
    setConvToDelete(id);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!convToDelete) return;
    try {
      await api.delete(`/history/${convToDelete}`);
      fetchConversations();
      if (activeConversationId === convToDelete) {
        onNewChat();
      }
    } catch (error) {
      console.error('Failed to delete', error);
      if (error.response?.status === 401) logout();
    }
  };

  const filteredConversations = useMemo(() => {
    if (!debouncedSearch) return conversations;
    const q = debouncedSearch.toLowerCase();
    return conversations.filter((c) => (c.title || '').toLowerCase().includes(q));
  }, [conversations, debouncedSearch]);

  const grouped = useMemo(() => groupConversationsByDate(filteredConversations), [filteredConversations]);
  const sidebarContent = (
    <div className="flex flex-col h-full w-full bg-[var(--surface-panel)] text-[var(--text-primary)]">
      <div className="h-14 flex items-center gap-3 px-4 border-b app-border shrink-0 md:hidden">
        <button
          onClick={() => { onNewChat(); onCloseSidebar?.(); }}
          aria-label={t('chat.newChat')}
          className="flex items-center gap-3 hover:bg-[var(--surface-subtle)] rounded-lg p-1 -m-1 transition-colors focus-ring"
        >
          <div className="w-9 h-9 rounded-lg btn-primary flex items-center justify-center">
            <span className="text-white font-bold text-sm">Q</span>
          </div>
          <span className="text-base font-semibold app-title truncate">{t('common.appName')}</span>
        </button>
        <button
          onClick={onCloseSidebar}
          className="ms-auto p-1.5 rounded-lg btn-ghost transition-colors md:hidden focus-ring"
          aria-label={t('common.close')}
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
      <div className="px-3 pt-4 pb-2 shrink-0">
        <button
          onClick={() => {
            onNewChat();
            onCloseSidebar?.();
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 btn-primary rounded-xl font-medium text-sm focus-ring"
          aria-label={t('chat.newChat')}
        >
          <Plus size={18} />
          <span>{t('chat.newChat')}</span>
        </button>
      </div>

      <div className="px-3 py-2.5 shrink-0">
        <div className="relative">
          <Search
            size={15}
            className={`absolute top-1/2 -translate-y-1/2 app-muted ${dir === 'rtl' ? 'right-3' : 'left-3'}`}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('chat.searchConversations')}
            className={`w-full ${
              dir === 'rtl' ? 'pr-9 pl-3' : 'pl-9 pr-3'
            } py-2.5 rounded-xl text-sm input-surface bg-[var(--surface-subtle)]`}
            aria-label={t('chat.searchConversations')}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-2">
        {loading ? (
          <SidebarSkeleton />
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-12 h-12 rounded-xl app-surface-subtle flex items-center justify-center mb-3">
              <MessageCircle size={22} className="app-muted" />
            </div>
            <p className="text-sm font-medium app-text">
              {debouncedSearch ? t('chat.noMatchingConversations') : t('chat.noConversations')}
            </p>
            <p className="text-xs app-muted mt-1">
              {debouncedSearch ? t('chat.tryDifferentSearch') : t('chat.startNewChat')}
            </p>
          </div>
        ) : (
          grouped.map(([labelKey, items]) => (
            <div key={labelKey} className="mb-2">
              <div className="px-3 pt-3 pb-1.5">
                <span className="text-[11px] font-semibold app-muted uppercase tracking-wider">
                  {t(GROUP_LABELS[labelKey])}
                </span>
              </div>
              {items.map((conv) => {
                const active = activeConversationId === conv.id;
                const title = conv.title || t('chat.untitledChat');
                return (
                  <div
                    key={conv.id}
                    className={`group w-full flex items-center gap-1 px-2 py-1.5 rounded-lg transition-all relative ${
                      active ? 'app-surface-subtle' : 'hover:bg-[var(--surface-subtle)]'
                    }`}
                  >
                    {active && (
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 w-1 h-6 rounded-full bg-[var(--accent-500)] ${
                          dir === 'rtl' ? 'right-0' : 'left-0'
                        }`}
                      />
                    )}
                    <button
                      onClick={() => {
                        onSelectConversation(conv.id);
                        onCloseSidebar?.();
                      }}
                      className="flex-1 min-w-0 flex items-center gap-2.5 px-1 py-1 rounded-md focus-ring"
                      aria-label={t('chat.openConversation', { title })}
                      aria-current={active ? 'page' : undefined}
                    >
                      <MessageSquare size={16} className="shrink-0 app-muted" />
                      <span className={`truncate text-sm ${active ? 'text-[var(--accent-500)]' : 'app-text'}`}>{title}</span>
                    </button>
                    <button
                      onClick={() => handleDeleteClick(conv.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg btn-ghost shrink-0 focus-ring"
                      title={t('common.delete')}
                      aria-label={t('common.delete')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      <UserProfileMenu user={user} logout={logout} onOpenSettings={onOpenSettings} collapsed={false} />
      </div>

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title={t('chat.deleteConversation')}
        message={t('chat.deleteConversationMessage')}
      />
    </div>
  );

  const chatsPopover = chatsOpen && chatsBtnRef.current && (() => {
    const rect = chatsBtnRef.current.getBoundingClientRect();
    const style = dir === 'rtl'
      ? { top: rect.top, right: window.innerWidth - rect.left + 12 }
      : { top: rect.top, left: rect.right + 12 };
    return (
      <div
        ref={chatsPopoverRef}
        className="fixed z-50 w-72 max-h-[70vh] rounded-xl app-surface-elevated shadow-lg border app-border flex flex-col animate-message-in"
        style={style}
      >
        {/* Search input */}
        <div className="p-3 border-b app-border shrink-0">
          <div className="relative">
            <Search size={15} className={`absolute top-1/2 -translate-y-1/2 app-muted ${dir === 'rtl' ? 'right-3' : 'left-3'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('chat.searchConversations')}
              className={`w-full ${dir === 'rtl' ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2 rounded-lg text-sm input-surface bg-[var(--surface-subtle)]`}
              aria-label={t('chat.searchConversations')}
              autoFocus
            />
          </div>
        </div>
        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-2">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center py-6 px-4 text-center">
              <MessageCircle size={20} className="app-muted mb-2" />
              <p className="text-xs app-muted">
                {debouncedSearch ? t('chat.noMatchingConversations') : t('chat.noConversations')}
              </p>
            </div>
          ) : (
            grouped.map(([labelKey, items]) => (
              <div key={labelKey} className="mb-1">
                <div className="px-2 pt-2 pb-1">
                  <span className="text-[10px] font-semibold app-muted uppercase tracking-wider">
                    {t(GROUP_LABELS[labelKey])}
                  </span>
                </div>
                {items.map((conv) => {
                  const active = activeConversationId === conv.id;
                  const title = conv.title || t('chat.untitledChat');
                  return (
                    <button
                      key={conv.id}
                      onClick={() => {
                        onSelectConversation(conv.id);
                        setChatsOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors focus-ring ${
                        active ? 'status-info' : 'hover:bg-[var(--surface-subtle)] app-text'
                      }`}
                    >
                      <MessageSquare size={14} className="shrink-0 app-muted" />
                      <span className="truncate">{title}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    );
  })();

  const collapsedContent = (
    <div className="flex flex-col items-center h-full w-full bg-[var(--surface-panel)] text-[var(--text-primary)]">
      {/* New Chat button — ghost sidebar style */}
      <div className="pt-4 pb-1 px-2 shrink-0 w-full flex justify-center">
        <button
          onClick={onNewChat}
          className="w-10 h-10 rounded-xl btn-ghost flex items-center justify-center focus-ring"
          title={t('chat.newChat')}
          aria-label={t('chat.newChat')}
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Conversations button — ghost sidebar style, opens popover */}
      <div className="px-2 pb-2 shrink-0 w-full flex justify-center">
        <button
          ref={chatsBtnRef}
          onClick={() => setChatsOpen((v) => !v)}
          className={`w-10 h-10 rounded-xl flex items-center justify-center focus-ring transition-colors ${
            chatsOpen ? 'bg-[var(--accent-soft)] text-[var(--accent-500)]' : 'btn-ghost'
          }`}
          title={t('chat.searchConversations')}
          aria-label={t('chat.searchConversations')}
        >
          <MessageSquare size={20} />
        </button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User avatar (collapsed) */}
      <UserProfileMenu user={user} logout={logout} onOpenSettings={onOpenSettings} collapsed />
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — icon rail when collapsed, full when expanded */}
      <div
        className={`hidden md:flex h-full shrink-0 bg-[var(--surface-panel)] ${
          dir === 'rtl' ? 'border-l' : 'border-r'
        } border-[var(--border-primary)] sidebar-transition ${
          isCollapsed ? 'w-16' : 'w-72'
        }`}
      >
        {isCollapsed ? collapsedContent : sidebarContent}
      </div>

      {/* Conversations popover (collapsed mode) */}
      {chatsPopover}

      {isSidebarOpen && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            onClick={onCloseSidebar}
            aria-hidden="true"
          />
          <div
            className={`absolute inset-y-0 w-72 z-40 animate-inline-panel ${
              dir === 'rtl' ? 'right-0' : 'left-0'
            }`}
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};

export default ChatSidebar;
