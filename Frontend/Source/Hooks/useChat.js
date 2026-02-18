import { useState, useRef } from 'react';
import { useAuth } from '../Context/AuthContext';
import { useLocale } from '../Context/LocaleContext';

export const useChat = () => {
    const { csrfToken, logout, refreshUser } = useAuth();
    const { t } = useLocale();
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasError, setHasError] = useState(false);

    // Store last request for retry functionality
    const lastRequestRef = useRef(null);
    const isSendingRef = useRef(false);

    // New Memory State
    const [isMemoryEnabled, setIsMemoryEnabled] = useState(true);
    const toggleMemory = () => setIsMemoryEnabled(prev => !prev);

    const updateLastMessage = (content) => {
        setMessages(prev => {
            const newPrev = [...prev];
            const lastMsg = newPrev[newPrev.length - 1];
            if (lastMsg.role === 'assistant') {
                newPrev[newPrev.length - 1] = { ...lastMsg, content };
            }
            return newPrev;
        });
    };

    const streamRequest = async (url, body, isFormData = false) => {
        setIsLoading(true);
        // Add a placeholder assistant message
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

        try {
            const headers = isFormData ? {} : { 'Content-Type': 'application/json' };
            // Add CSRF token for non-GET requests (cookie-based auth handles JWT automatically)
            if (csrfToken) {
                headers['X-CSRF-Token'] = csrfToken;
            }

            const response = await fetch(`/api${url}`, {
                method: 'POST',
                headers,
                credentials: 'include',
                body: isFormData ? body : JSON.stringify(body)
            });

            if (response.status === 401) {
                logout();
                throw new Error(t('errors.unauthorized'));
            }

            if (response.status === 429) {
                const errorData = await response.json();
                throw new Error(errorData.message || t('errors.tokenLimit'));
            }

            if (!response.body) throw new Error('ReadableStream not supported');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedText = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                accumulatedText += chunk;
                updateLastMessage(accumulatedText);
            }
        } catch (error) {
            console.error("Stream error:", error);
            setHasError(true);
            // Update the placeholder message with error flag
            setMessages(prev => {
                const newPrev = [...prev];
                const lastMsg = newPrev[newPrev.length - 1];
                if (lastMsg.role === 'assistant') {
                    newPrev[newPrev.length - 1] = {
                        ...lastMsg,
                        content: error.message || t('errors.generic'),
                        isError: true
                    };
                }
                return newPrev;
            });
        } finally {
            setIsLoading(false);
            // Refresh user data to update token usage in header
            if (refreshUser) refreshUser();
        }
    };

    const retryLastMessage = async (conversationId = null) => {
        if (!lastRequestRef.current) return;

        const { text, file, modelProvider, groqModel } = lastRequestRef.current;
        setHasError(false);

        // Remove the error message and original user message to resend
        setMessages(prev => {
            // Remove last assistant message (error) and last user message
            const filtered = prev.filter((msg, idx) => {
                if (idx === prev.length - 1 && msg.isError) return false;
                if (idx === prev.length - 2 && msg.role === 'user') return false;
                return true;
            });
            return filtered;
        });

        // Resend the message
        await sendMessage(text, file, conversationId, modelProvider, groqModel);
    };

    const sendMessage = async (text, file = null, conversationId = null, modelProvider = 'azure', groqModel = null) => {
        if (isSendingRef.current) return;
        isSendingRef.current = true;

        try {
            // Store request for retry functionality
            lastRequestRef.current = { text, file, modelProvider, groqModel };
            setHasError(false);

            // Optimistic UI Update
            const userMsg = { role: 'user', content: text || '' };
            if (file) {
                userMsg.attachment_name = file.name;
            }
            setMessages(prev => [...prev, userMsg]);

            const formData = new FormData();
            formData.append('message', text);

            // Chat Memory: Send last 10 messages ONLY if enabled
            if (isMemoryEnabled) {
                try {
                    const history = JSON.stringify(
                        messages.slice(-10).map(({ role, content }) => ({ role, content }))
                    );
                    formData.append('history', history);
                } catch (e) {
                    console.error("Failed to serialize history", e);
                }
            }

            if (file) {
                formData.append('file', file);
            }

            if (conversationId) {
                formData.append('conversation_id', conversationId);
            }

            if (modelProvider) {
                formData.append('model_provider', modelProvider);
            }

            if (modelProvider === 'groq' && groqModel) {
                formData.append('model_name', groqModel);
            }

            // Send to unified /chat endpoint
            await streamRequest('/chat', formData, true);
        } finally {
            isSendingRef.current = false;
        }
    };

    return {
        messages,
        setMessages, // Expose setMessages to allow loading history
        isLoading,
        sendMessage,
        isMemoryEnabled,
        setIsMemoryEnabled,
        toggleMemory,
        hasError,
        retryLastMessage
    };
};
