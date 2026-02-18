import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Paperclip, Check, Copy, RefreshCw } from 'lucide-react';
import { useLocale } from '../Context/LocaleContext';
import { getTextDirection } from '../utils/direction';

const ChatBubble = memo(
  ({
    message,
    index,
    onCopy,
    copiedIdx,
    onRetry,
    isStreaming,
    userInitial,
    thinkingText = 'Thinking...',
    isGrouped = false,
    isFirst = false
  }) => {
    const { t } = useLocale();
    const isUser = message.role === 'user';
    const isAssistant = message.role === 'assistant';
    const isSystem = message.role === 'system';
    const contentDirection = getTextDirection(message.content || message.attachment_name);

    const userProseClasses =
      'user-bubble-prose prose-pre:bg-blue-100/70 prose-code:text-blue-900 prose-code:bg-blue-100 prose-a:text-blue-800 prose-a:underline prose-strong:text-blue-950 prose-headings:text-blue-950 dark:prose-pre:bg-white/10 dark:prose-code:text-white dark:prose-code:bg-white/15 dark:prose-a:text-blue-100 dark:prose-strong:text-white dark:prose-headings:text-white';
    const assistantProseClasses =
      'prose-stone dark:prose-invert prose-pre:bg-[var(--surface-subtle)] dark:prose-pre:bg-[var(--surface-subtle)]';

    const marginClass = isFirst ? 'mt-0' : 'mt-6';

    if (isSystem) {
      return (
        <div className={`flex justify-center animate-message-in ${marginClass}`}>
          <div className="max-w-md px-4 py-2 rounded-full app-surface-subtle text-sm app-text text-center">
            {message.content?.startsWith(t('chat.systemMessageAttachment')) ? (
              <span className="flex items-center gap-2 justify-center">
                <Paperclip size={13} />
                {message.content}
              </span>
            ) : (
              message.content
            )}
          </div>
        </div>
      );
    }

    const groupMarginClass = isFirst ? 'mt-0' : isGrouped ? 'mt-1' : 'mt-6';

    return (
      <div className={`flex gap-3 animate-message-in ${groupMarginClass} ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {isGrouped ? (
          <div className="w-9 shrink-0" />
        ) : isUser ? (
          <div className="w-9 h-9 rounded-full btn-primary flex items-center justify-center text-white font-semibold text-xs shrink-0 mt-1">
            {userInitial || 'U'}
          </div>
        ) : (
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-1 ${
              message.isError ? 'status-danger' : 'btn-primary'
            }`}
          >
            {message.isError ? (
              <span className="text-xs font-bold">!</span>
            ) : (
              <span className="text-white font-bold text-xs">Q</span>
            )}
          </div>
        )}

        <div
          className={`relative group flex-1 px-5 py-4 ${
            message.isError
              ? 'status-danger rounded-2xl'
              : isUser
                ? 'rounded-2xl bubble-user'
                : 'bubble-assistant rounded-2xl'
          }`}
        >
          <button
            onClick={() => onCopy(message.content || message.attachment_name || '', index)}
            className={`absolute top-2.5 ${contentDirection === 'rtl' ? 'right-2.5' : 'left-2.5'} p-1.5 rounded-lg transition-all sm:opacity-0 sm:group-hover:opacity-100 focus-ring ${
              copiedIdx === index
                ? isUser
                  ? 'status-info opacity-100'
                  : 'status-success opacity-100'
                : 'btn-ghost opacity-60'
            }`}
            title={t('chat.copyToClipboard')}
            aria-label={t('chat.copyMessage')}
          >
            {copiedIdx === index ? <Check size={14} /> : <Copy size={14} />}
          </button>

          {message.attachment_name && (
            <div
              className={`flex items-center gap-2 font-medium ${
                isUser ? 'text-blue-900 dark:text-white/90' : 'app-text'
              }${message.content ? ' mb-3 pb-2 border-b app-border' : ''}`}
            >
              <div className={`p-1.5 rounded-md ${isUser ? 'bg-blue-200/50 dark:bg-white/15' : 'app-surface-subtle'}`}>
                <Paperclip size={13} />
              </div>
              <span className="text-sm break-words" dir="auto">{message.attachment_name}</span>
            </div>
          )}

          {message.content ? (
            <div
              className={`prose max-w-none prose-p:leading-relaxed prose-pre:rounded-xl ${
                isUser ? userProseClasses : assistantProseClasses
              } ${contentDirection === 'rtl' ? 'text-right' : 'text-left'} ${isStreaming ? 'streaming-cursor' : ''}`}
              dir={contentDirection}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code: ({ className, children, ...props }) => (
                    <code className={className} dir="ltr" {...props}>
                      {children}
                    </code>
                  ),
                  pre: ({ children, ...props }) => (
                    <pre dir="ltr" {...props}>
                      {children}
                    </pre>
                  )
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          ) : isStreaming && isAssistant ? (
            <div className="flex items-center gap-3 py-1">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[var(--accent-500)] animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 rounded-full bg-[var(--accent-500)] animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 rounded-full bg-[var(--accent-500)] animate-bounce" />
              </div>
              <span className="text-sm app-muted animate-pulse">{thinkingText}</span>
            </div>
          ) : null}

          {message.isError && onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg btn-primary focus-ring"
              aria-label={t('common.retry')}
            >
              <RefreshCw size={14} />
              {t('common.retry')}
            </button>
          )}
        </div>
      </div>
    );
  }
);

ChatBubble.displayName = 'ChatBubble';

export default ChatBubble;
