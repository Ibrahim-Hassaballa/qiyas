import { useRef, useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

import { useChat } from '../Hooks/useChat';
import { useAuth } from '../Context/AuthContext';
import { useTheme } from '../Context/ThemeContext';
import { useLocale } from '../Context/LocaleContext';
import api from '../Services/api';

import ChatHeader from '../Components/ChatHeader';
import ChatBubble from '../Components/ChatBubble';
import MessageInput from '../Components/MessageInput';
import SettingsModal from '../Components/SettingsModal';
import ChatSidebar from '../Components/ChatSidebar';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ChatPage = () => {
  const { conversationId: urlConversationId } = useParams();
  const navigate = useNavigate();
  const { messages, setMessages, isLoading, sendMessage, setIsMemoryEnabled, retryLastMessage } = useChat();
  const { logout, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { t } = useLocale();
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);

  // Tenant settings (admin-configured, fetched from backend)
  const [tenantSettings, setTenantSettings] = useState({
    context_memory_enabled: true,
    model_provider: 'azure',
    groq_model: '',
    system_prompt: ''
  });

  const [activeConversationId, setActiveConversationId] = useState(() => {
    if (urlConversationId && UUID_REGEX.test(urlConversationId)) {
      return urlConversationId;
    }
    return null;
  });
  const [conversationTitle, setConversationTitle] = useState('');
  const [refreshSidebar, setRefreshSidebar] = useState(0);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sidebar collapse state (desktop only), persisted in localStorage
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    } catch {
      // localStorage unavailable (e.g. incognito)
      return false;
    }
  });

  // Scroll-to-bottom state
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollContainerRef = useRef(null);
  const scrollRafRef = useRef(null);

  const initialLoadDone = useRef(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(
    () => !!(urlConversationId && UUID_REGEX.test(urlConversationId))
  );

  const messagesEndRef = useRef(null);
  const userInitial = user?.username?.charAt(0)?.toUpperCase() || 'U';

  const toggleSidebarCollapse = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar-collapsed', String(next));
      } catch {
        // localStorage unavailable
      }
      return next;
    });
  }, []);

  const fetchTenantSettings = useCallback(async () => {
    try {
      const res = await api.get('/settings');
      setTenantSettings(res.data);
      // Sync memory enabled from tenant settings
      setIsMemoryEnabled(res.data.context_memory_enabled ?? true);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) logout();
    }
  }, [logout, setIsMemoryEnabled]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch tenant settings on mount
  useEffect(() => {
    fetchTenantSettings();
  }, [fetchTenantSettings]);

  // Ctrl+B / Cmd+B keyboard shortcut for sidebar collapse
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        toggleSidebarCollapse();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [toggleSidebarCollapse]);

  // Scroll handler (RAF-throttled) for scroll-to-bottom button
  const handleScroll = useCallback(() => {
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      const el = scrollContainerRef.current;
      if (el) {
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        setShowScrollButton(distanceFromBottom > 200);
      }
      scrollRafRef.current = null;
    });
  }, []);

  // Cleanup pending RAF on unmount
  useEffect(() => {
    return () => {
      if (scrollRafRef.current) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, []);

  // Sync URL conversationId -> component state (handles refresh, back/forward, direct links)
  useEffect(() => {
    if (urlConversationId) {
      if (!UUID_REGEX.test(urlConversationId)) {
        navigate('/', { replace: true });
        return;
      }
      if (urlConversationId !== activeConversationId || !initialLoadDone.current) {
        initialLoadDone.current = true;
        handleSelectConversation(urlConversationId);
      }
    } else {
      initialLoadDone.current = true;
      // URL is "/" - clear conversation state (e.g. browser back to home)
      if (activeConversationId !== null) {
        setActiveConversationId(null);
        setConversationTitle('');
        setMessages([]);
        setIsLoadingConversation(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlConversationId]);

  const handleNewChat = useCallback(() => {
    setActiveConversationId(null);
    setConversationTitle('');
    setMessages([]);
    navigate('/');
  }, [setMessages, navigate]);

  const handleSelectConversation = useCallback(
    async (id) => {
      setActiveConversationId(id);
      setIsLoadingConversation(true);
      navigate(`/c/${id}`, { replace: true });
      try {
        const response = await api.get(`/history/${id}`);
        const history = response.data.messages || response.data;
        const uiMessages = history.map((msg) => ({
          role: msg.role,
          content: msg.content,
          attachment_name: msg.attachment_name
        }));
        if (uiMessages.length === 0) {
          setMessages([{ role: 'system', content: t('chat.emptyConversation') }]);
        } else {
          setMessages(uiMessages);
        }
        const title =
          response.data.title || history.find((m) => m.role === 'user')?.content?.substring(0, 40) || t('chat.newConversation');
        setConversationTitle(title);
      } catch (error) {
        console.error('Failed to load conversation', error);
        if (error.response?.status === 401) {
          logout();
        } else if (error.response?.status === 400 || error.response?.status === 404) {
          setActiveConversationId(null);
          setConversationTitle('');
          setMessages([]);
          navigate('/', { replace: true });
        }
      } finally {
        setIsLoadingConversation(false);
      }
    },
    [setMessages, logout, t, navigate]
  );

  const handleCopy = useCallback((text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }, []);

  // Shared helper: ensure a conversation exists, then send the message
  const sendWithConversation = async (text, file) => {
    let targetId = activeConversationId;
    if (!targetId) {
      try {
        const titleText = text.trim() || (file ? file.name : t('chat.newChat'));
        const createRes = await api.post('/history/', { title: titleText.substring(0, 30) });
        const newConv = createRes.data;
        targetId = newConv.id;
        setActiveConversationId(targetId);
        setConversationTitle(titleText.substring(0, 40));
        setRefreshSidebar((prev) => prev + 1);
        navigate(`/c/${targetId}`, { replace: true });
        await sendMessage(text, file, targetId, tenantSettings.model_provider, tenantSettings.groq_model);
      } catch (err) {
        console.error('Failed to create new chat', err);
        if (err.response?.status === 401) return logout();
        await sendMessage(text, file, null, tenantSettings.model_provider, tenantSettings.groq_model);
      }
    } else {
      await sendMessage(text, file, targetId, tenantSettings.model_provider, tenantSettings.groq_model);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading || (!input.trim() && !selectedFile)) return;

    const messageText = input;
    const file = selectedFile;
    setInput('');
    setSelectedFile(null);

    await sendWithConversation(messageText, file);
  };

  const handleFileSelect = (e) => {
    if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
  };

  const showWelcome = messages.length === 0 && !isLoading && !isLoadingConversation;

  const getThinkingText = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const hasFile = !!lastUser?.attachment_name;
    const hasText = !!lastUser?.content?.trim();
    if (hasFile && hasText) return t('chat.analyzingDocumentAndQuestion');
    if (hasFile) return t('chat.analyzingDocument');
    return t('chat.thinking');
  };

  return (
    <div className="flex flex-col h-screen app-shell overflow-hidden font-sans">
      {/* Row 1: Unified header */}
      <ChatHeader
        conversationTitle={conversationTitle}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        onNewChat={handleNewChat}
        sidebarCollapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />

      {/* Row 2: Sidebar body + content */}
      <div className="flex flex-1 min-h-0">
        <ChatSidebar
          onSelectConversation={handleSelectConversation}
          onNewChat={handleNewChat}
          activeConversationId={activeConversationId}
          refreshTrigger={refreshSidebar}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isSidebarOpen={sidebarOpen}
          onCloseSidebar={() => setSidebarOpen(false)}
          isCollapsed={sidebarCollapsed}
        />

        <div className="flex-1 flex flex-col min-w-0 app-shell transition-colors relative">
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 py-8 scroll-smooth custom-scrollbar"
          >
          {showWelcome ? (
            <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto text-center px-4">
              <div className="w-20 h-20 rounded-2xl brand-glow flex items-center justify-center mb-8">
                <span className="text-white font-bold text-3xl">Q</span>
              </div>
              <h2 className="text-2xl font-bold app-title mb-3">{t('chat.welcomeTitle')}</h2>
              <p className="text-base app-text mb-10 max-w-sm leading-relaxed">{t('chat.welcomeDescription')}</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto w-full">
              {messages.map((msg, idx) => {
                const isGrouped = idx > 0
                  && messages[idx - 1].role === msg.role
                  && !msg.isError
                  && msg.role !== 'system';

                return (
                  <ChatBubble
                    key={idx}
                    message={msg}
                    index={idx}
                    onCopy={handleCopy}
                    copiedIdx={copiedIdx}
                    onRetry={msg.isError ? () => retryLastMessage(activeConversationId) : null}
                    isStreaming={isLoading && msg.role === 'assistant' && idx === messages.length - 1}
                    userInitial={userInitial}
                    thinkingText={getThinkingText()}
                    isGrouped={isGrouped}
                    isFirst={idx === 0}
                  />
                );
              })}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

          {/* Scroll-to-bottom button */}
          {showScrollButton && (
            <button
              onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="absolute bottom-20 left-1/2 -translate-x-1/2 p-2 rounded-full btn-secondary shadow-lg z-10 transition-opacity duration-150 hover:shadow-xl focus-ring"
              aria-label={t('chat.scrollToBottom')}
            >
              <ChevronDown size={20} />
            </button>
          )}

          <MessageInput
            input={input}
            setInput={setInput}
            handleFileSelect={handleFileSelect}
            handleSubmit={handleSubmit}
            isLoading={isLoading}
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
          />
        </div>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        setTheme={setTheme}
      />
    </div>
  );
};

export default ChatPage;
