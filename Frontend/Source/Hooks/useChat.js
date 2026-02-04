import { useState, useRef } from 'react';
import { useAuth } from '../Context/AuthContext';

export const useChat = () => {
    const { csrfToken, logout } = useAuth();
    const [messages, setMessages] = useState([
        { role: 'system', content: 'Welcome to QiyasAI Copilot. How can I assist you with DGA Qiyas controls today?' }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasError, setHasError] = useState(false);

    // Store last request for retry functionality
    const lastRequestRef = useRef(null);

    // New Memory State
    const [isMemoryEnabled, setIsMemoryEnabled] = useState(true);
    const toggleMemory = () => setIsMemoryEnabled(prev => !prev);

    const addMessage = (role, content) => {
        setMessages(prev => [...prev, { role, content }]);
    };

    const updateLastMessage = (content) => {
        setMessages(prev => {
            const newPrev = [...prev];
            const lastMsg = newPrev[newPrev.length - 1];
            if (lastMsg.role === 'assistant') {
                lastMsg.content = content;
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
                throw new Error("Unauthorized");
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
                    lastMsg.content = 'Sorry, I encountered an error processing your request. Please ensure the backend is running.';
                    lastMsg.isError = true;
                }
                return newPrev;
            });
        } finally {
            setIsLoading(false);
        }
    };

    const retryLastMessage = async (conversationId = null) => {
        if (!lastRequestRef.current) return;

        const { text, file } = lastRequestRef.current;
        setHasError(false);

        // Remove the error message and original user message to resend
        setMessages(prev => {
            // Remove last assistant message (error) and last user message
            const filtered = prev.filter((msg, idx) => {
                if (idx === prev.length - 1 && msg.isError) return false;
                if (idx === prev.length - 2 && msg.role === 'user') return false;
                // Also remove file attachment system message if present
                if (idx === prev.length - 3 && msg.role === 'system' && msg.content.startsWith('Attached file:')) return false;
                return true;
            });
            return filtered;
        });

        // Resend the message
        await sendMessage(text, file, conversationId);
    };

    const sendMessage = async (text, file = null, conversationId = null) => {
        // Store request for retry functionality
        lastRequestRef.current = { text, file };
        setHasError(false);

        // Optimistic UI Update
        addMessage('user', text);
        if (file) {
            addMessage('system', `Attached file: ${file.name}`);
        }

        const formData = new FormData();
        formData.append('message', text);

        // Chat Memory: Send last 10 messages ONLY if enabled
        if (isMemoryEnabled) {
            try {
                const history = JSON.stringify(messages.slice(-10));
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

        // Send to unified /chat endpoint
        await streamRequest('/chat', formData, true);
    };

    return {
        messages,
        setMessages, // Expose setMessages to allow loading history
        isLoading,
        sendMessage,
        isMemoryEnabled,
        toggleMemory,
        hasError,
        retryLastMessage
    };
};
