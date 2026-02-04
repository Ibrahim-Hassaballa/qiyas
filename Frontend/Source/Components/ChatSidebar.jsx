import { useEffect, useState } from 'react';
import { useAuth } from '../Context/AuthContext';
import api from '../Services/api';

import DeleteConfirmModal from './DeleteConfirmModal';

const ChatSidebar = ({ onSelectConversation, onNewChat, activeConversationId, refreshTrigger }) => {
    const { user, logout } = useAuth();
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [convToDelete, setConvToDelete] = useState(null);

    const fetchConversations = async () => {
        if (!user) return;
        try {
            const response = await api.get('/history/');
            if (Array.isArray(response.data)) {
                setConversations(response.data);
            } else {
                console.error("Expected array for conversations, got:", response.data);
                setConversations([]);
            }
        } catch (error) {
            console.error("Failed to fetch conversations", error);
            if (error.response?.status === 401) logout();
            setConversations([]);
        }
    };

    useEffect(() => {
        fetchConversations();
    }, [user, activeConversationId, refreshTrigger]);

    // Open Modal
    const handleDeleteClick = (e, id) => {
        e.stopPropagation();
        setConvToDelete(id);
        setDeleteModalOpen(true);
    };

    // Actual Delete Logic
    const confirmDelete = async () => {
        if (!convToDelete) return;
        try {
            await api.delete(`/history/${convToDelete}`);
            fetchConversations();
            if (activeConversationId === convToDelete) {
                onNewChat(); // Reset to new chat if deleted active one
            }
        } catch (error) {
            console.error("Failed to delete", error);
            if (error.response?.status === 401) logout();
        }
    };

    return (
        <div className="w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-full">
            <div className="p-4">
                <button
                    onClick={onNewChat}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium shadow-sm"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>New Chat</span>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 space-y-1">
                {conversations.length === 0 ? (
                    <div className="text-center text-gray-400 py-8 text-sm">
                        No history yet.
                    </div>
                ) : (
                    conversations.map((conv) => (
                        <div
                            key={conv.id}
                            onClick={() => onSelectConversation(conv.id)}
                            className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${activeConversationId === conv.id
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                                }`}
                        >
                            <div className="flex flex-col min-w-0">
                                <span className="truncate text-sm font-medium">
                                    {conv.title || "Untitled Chat"}
                                </span>
                                <span className="text-xs text-gray-400">
                                    {new Date(conv.created_at).toLocaleDateString()}
                                </span>
                            </div>

                            <button
                                onClick={(e) => handleDeleteClick(e, conv.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                                title="Delete"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    ))
                )}
            </div>

            <DeleteConfirmModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="Delete Conversation"
                message="Are you sure you want to delete this conversation? This action cannot be undone."
            />
        </div>
    );
};

export default ChatSidebar;
