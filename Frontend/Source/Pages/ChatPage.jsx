import { useRef, useEffect, useState } from 'react';
import { Loader2, Shield } from 'lucide-react';
import { useChat } from '../Hooks/useChat';
import { useAuth } from '../Context/AuthContext';
import api from '../Services/api';

// Components
import ChatHeader from '../Components/ChatHeader';
import ChatBubble from '../Components/ChatBubble';
import MessageInput from '../Components/MessageInput';
import SettingsModal from '../Components/SettingsModal';
import ChatSidebar from '../Components/ChatSidebar';

const ChatPage = () => {
    // 1. Hooks & Auth
    const { messages, setMessages, isLoading, sendMessage, isMemoryEnabled, toggleMemory, retryLastMessage } = useChat();
    const { logout, user } = useAuth();

    // 2. UI State
    const [input, setInput] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [copiedIdx, setCopiedIdx] = useState(null);
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

    // 3. History State
    const [activeConversationId, setActiveConversationId] = useState(null);
    const [refreshSidebar, setRefreshSidebar] = useState(0);

    // 4. Settings State (Refactored)
    const [activeTab, setActiveTab] = useState('general');
    const [controls, setControls] = useState([]);
    const [systemPrompt, setSystemPrompt] = useState('');
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const messagesEndRef = useRef(null);
    const controlInputRef = useRef(null);

    // --- EFFECTS ---
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark') root.classList.add('dark');
        else root.classList.remove('dark');
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        if (isSettingsOpen) {
            if (activeTab === 'kb') fetchControls();
            if (activeTab === 'system') fetchSettings();
        }
    }, [isSettingsOpen, activeTab]);

    // --- CONVERSATION LOGIC ---
    const handleNewChat = () => {
        setActiveConversationId(null);
        setMessages([
            { role: 'system', content: 'Welcome to QiyasAI Copilot. How can I assist you with DGA Qiyas controls today?' }
        ]);
    };

    const handleSelectConversation = async (id) => {
        setActiveConversationId(id);

        try {
            const response = await api.get(`/history/${id}`);
            // Handle paginated response format
            const history = response.data.messages || response.data;
            const uiMessages = history.map(msg => ({
                role: msg.role,
                content: msg.content,
                attachment_name: msg.attachment_name
            }));
            if (uiMessages.length === 0) {
                setMessages([{ role: 'system', content: 'Empty conversation.' }]);
            } else {
                setMessages(uiMessages);
            }
        } catch (error) {
            console.error("Failed to load conversation", error);
            if (error.response?.status === 401) logout();
        }
    };

    // --- HANDLERS ---
    const handleCopy = (text, idx) => {
        navigator.clipboard.writeText(text);
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx(null), 2000);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim() && !selectedFile) return;

        if (input.trim() || selectedFile) {
            // Pass activeConversationId to persist message in the correct chat

            // CORRECT LOGIC:
            // 1. If activeConversationId is NULL, we need to CREATE a conversation first?
            // OR
            // 2. The backend should create one if missing?
            // The current Chat.py logic ONLY saves if `conversation_id` is present.

            // FIX: If activeConversationId is null, I should probably Create a Conversation via API first, 
            // get the ID, set it as active, and THEN send the message?
            // YES. This is safer.

            let targetId = activeConversationId;
            if (!targetId) {
                try {
                    const createRes = await api.post('/history/',
                        { title: input.substring(0, 30) || "New Chat" }
                    );
                    const newConv = createRes.data;
                    targetId = newConv.id;
                    setActiveConversationId(targetId);
                    setRefreshSidebar(prev => prev + 1);
                    await sendMessage(input, selectedFile, targetId);
                } catch (err) {
                    console.error("Failed to create new chat", err);
                    if (err.response?.status === 401) return logout();
                    await sendMessage(input, selectedFile, null);
                }
            } else {
                await sendMessage(input, selectedFile, targetId);
            }

            setInput('');
            setSelectedFile(null);
        }
    };

    // --- API HELPERS (Settings/Controls) ---
    // [Keep existing fetchControls, fetchSettings, saveSettings, etc.]
    // I will inline them here for brevity in replacement, assuming they didn't change logic, just indentation.

    // ... (fetchControls, fetchSettings, saveSettings, handleUploadControl, handleDeleteControl logic copied below)

    const fetchControls = async () => {
        try {
            const res = await api.get('/controls/controls');
            setControls(res.data.files || []);
        } catch (err) {
            console.error(err);
            if (err.response?.status === 401) logout();
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await api.get('/settings');
            if (res.data.system_prompt) setSystemPrompt(res.data.system_prompt);
        } catch (err) {
            console.error(err);
            if (err.response?.status === 401) logout();
        }
    };

    const saveSettings = async () => {
        setIsSavingSettings(true);
        try {
            await api.post('/settings', { system_prompt: systemPrompt });
            alert("Settings saved!");
        } catch (err) {
            alert("Failed to save settings");
            if (err.response?.status === 401) logout();
        }
        finally { setIsSavingSettings(false); }
    };

    const handleUploadControl = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            await api.post('/controls/controls/upload', formData);
            fetchControls();
        } catch (err) {
            alert("Upload failed");
            if (err.response?.status === 401) logout();
        }
        finally { setIsUploading(false); }
    };

    const handleDeleteControl = async (filename) => {
        if (!confirm(`Delete ${filename}?`)) return;
        try {
            await api.delete(`/controls/controls/${filename}`);
            fetchControls();
        } catch (err) {
            console.error(err);
            if (err.response?.status === 401) logout();
        }
    };

    const handleFileSelect = (e) => {
        if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
    };

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
            {/* 1. Sidebar */}
            <ChatSidebar
                onSelectConversation={handleSelectConversation}
                onNewChat={handleNewChat}
                activeConversationId={activeConversationId}
                refreshTrigger={refreshSidebar}
            />

            {/* 2. Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900/50 transition-colors duration-300 relative">

                <ChatHeader
                    user={user}
                    logout={logout}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                />

                {/* Messages List */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 scroll-smooth custom-scrollbar">
                    {messages.map((msg, idx) => (
                        <ChatBubble
                            key={idx}
                            message={msg}
                            index={idx}
                            onCopy={handleCopy}
                            copiedIdx={copiedIdx}
                            onRetry={msg.isError ? () => retryLastMessage(activeConversationId) : null}
                        />
                    ))}

                    {/* Typing Indicator */}
                    {isLoading && (
                        <div className="flex gap-4 max-w-4xl mx-auto">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center animate-pulse">
                                <Shield size={14} className="text-white" />
                            </div>
                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-500 text-sm py-2">
                                <Loader2 size={16} className="animate-spin" />
                                <span>Analyzing Request...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
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

            {/* Settings Modal */}
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                theme={theme}
                setTheme={setTheme}
                isMemoryEnabled={isMemoryEnabled}
                toggleMemory={toggleMemory}
                controls={controls}
                controlInputRef={controlInputRef}
                handleUploadControl={handleUploadControl}
                handleDeleteControl={handleDeleteControl}
                isUploading={isUploading}
                systemPrompt={systemPrompt}
                setSystemPrompt={setSystemPrompt}
                saveSettings={saveSettings}
                isSavingSettings={isSavingSettings}
            />
        </div>
    );
};

export default ChatPage;
