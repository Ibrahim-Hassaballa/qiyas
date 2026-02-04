import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Shield, Paperclip, Check, Copy, RefreshCw } from 'lucide-react';

const ChatBubble = ({ message, index, onCopy, copiedIdx, onRetry }) => {
    return (
        <div
            className={`flex gap-4 max-w-4xl mx-auto ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
        >
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${message.role === 'assistant'
                ? 'bg-gradient-to-tr from-cyan-500 to-blue-500 dark:from-cyan-600 dark:to-blue-600 shadow-lg shadow-cyan-500/20 dark:shadow-cyan-900/20'
                : message.role === 'system'
                    ? 'bg-purple-100 dark:bg-purple-900/50'
                    : 'bg-slate-200 dark:bg-slate-700'
                }`}>
                {message.role === 'assistant' ? <Shield size={14} className="text-white" /> :
                    message.role === 'system' ? <Paperclip size={14} className="text-purple-600 dark:text-purple-300" /> :
                        <div className="w-2 h-2 bg-slate-500 dark:bg-slate-400 rounded-full" />}
            </div>

            {/* Bubble */}
            <div
                className={`relative group flex-1 rounded-2xl px-6 py-4 shadow-sm ${message.role === 'user'
                    ? 'bg-white border border-slate-100 text-slate-800 dark:bg-slate-800 dark:border-transparent dark:text-slate-100 rounded-tr-sm'
                    : message.role === 'system'
                        ? 'bg-purple-50 border border-purple-100 text-purple-700 dark:bg-purple-950/30 dark:border-purple-900/30 dark:text-purple-200 text-sm'
                        : 'bg-slate-100 border border-slate-200 text-slate-700 dark:bg-slate-950/40 dark:border-slate-800/50 dark:text-slate-300 rounded-tl-sm'
                    }`}
            >
                <button
                    onClick={() => onCopy(message.content, index)}
                    className={`absolute top-2 right-2 p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${copiedIdx === index
                        ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 opacity-100'
                        : 'bg-black/5 text-slate-400 hover:bg-black/10 hover:text-slate-600 dark:bg-white/5 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-slate-300'
                        }`}
                    title="Copy to clipboard"
                >
                    {copiedIdx === index ? <Check size={14} /> : <Copy size={14} />}
                </button>

                {/* Attachment Indicator */}
                {message.attachment_name && (
                    <div className="mb-3 pb-2 border-b border-slate-200 dark:border-slate-700/50 flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                        <div className="p-1.5 bg-slate-200 dark:bg-slate-800 rounded-md">
                            <Paperclip size={14} />
                        </div>
                        <span className="text-sm truncate max-w-[250px]">{message.attachment_name}</span>
                    </div>
                )}

                <div
                    className={`prose prose-slate max-w-none prose-p:leading-relaxed dark:prose-invert prose-pre:bg-slate-800 dark:prose-pre:bg-slate-900 ${message.role === 'assistant' && /[\u0600-\u06FF]/.test(message.content) ? 'text-right' : 'text-left'
                        }`}
                    dir={message.role === 'assistant' && /[\u0600-\u06FF]/.test(message.content) ? 'rtl' : 'auto'}
                >
                    {message.role === 'system' && message.content.startsWith('Attached') ? (
                        <span>{message.content}</span>
                    ) : (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                    )}
                </div>

                {/* Retry button for error messages */}
                {message.isError && onRetry && (
                    <button
                        onClick={onRetry}
                        className="mt-3 flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-lg shadow-md hover:shadow-lg transition-all"
                    >
                        <RefreshCw size={14} />
                        Retry
                    </button>
                )}
            </div>
        </div>
    );
};

export default ChatBubble;
