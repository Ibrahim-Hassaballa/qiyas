import React, { useRef, useEffect } from 'react';
import { Send, Paperclip, X } from 'lucide-react';
import { useLocale } from '../Context/LocaleContext';

const MessageInput = ({
  input,
  setInput,
  handleFileSelect,
  handleSubmit,
  isLoading,
  selectedFile,
  setSelectedFile
}) => {
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const { t, dir } = useLocale();

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
    }
  }, [input]);

  return (
    <div className="shrink-0 relative">
      <div className="input-fade-overlay h-4 pointer-events-none absolute -top-4 left-0 right-0" />

      <div className="p-3 sm:p-4 app-shell transition-colors">
        <div className="max-w-3xl mx-auto">
          <form
            onSubmit={handleSubmit}
            className="relative app-surface-input rounded-2xl"
          >
            {selectedFile && (
              <div className="px-4 pt-3 pb-0">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-xs status-info">
                  <Paperclip size={12} />
                  <span className="truncate max-w-[200px]" dir="auto">{selectedFile.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                    className="hover:brightness-75 transition-colors focus-ring rounded"
                    aria-label={t('chat.removeFile')}
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-end gap-2 p-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`p-2.5 rounded-lg transition-colors shrink-0 focus-ring ${
                  selectedFile ? 'status-info' : 'btn-ghost'
                }`}
                title={t('chat.attachDocument')}
                aria-label={t('chat.attachDocument')}
              >
                <Paperclip size={18} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileSelect}
                accept=".pdf,.docx,.txt"
              />

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder={t('chat.placeholder')}
                className="flex-1 bg-transparent border-0 app-title placeholder:text-[var(--text-muted)] focus:ring-0 focus:outline-none py-2.5 px-1 resize-none custom-scrollbar text-sm leading-relaxed"
                rows={1}
                aria-label={t('chat.placeholder')}
                dir={dir}
              />

              <button
                type="submit"
                disabled={isLoading || (!input.trim() && !selectedFile)}
                className="p-3 rounded-xl btn-primary disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none transition-all shrink-0 focus-ring"
                aria-label={t('chat.sendMessage')}
              >
                <Send size={18} />
              </button>
            </div>
          </form>
          <p className="text-center mt-2.5 text-xs app-muted">{t('chat.disclaimer')}</p>
        </div>
      </div>
    </div>
  );
};

export default MessageInput;
