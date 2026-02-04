import React, { useRef } from 'react';
import { Send, Paperclip, CheckCircle, FileCheck } from 'lucide-react';

const MessageInput = ({ input, setInput, handleFileSelect, handleSubmit, isLoading, selectedFile, setSelectedFile }) => {
    const fileInputRef = useRef(null);

    return (
        <div className="p-4 sm:p-6 bg-white/80 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800/50 backdrop-blur-md transition-colors">
            <form
                onSubmit={handleSubmit}
                className="max-w-4xl mx-auto relative flex gap-3 items-end p-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/20 focus-within:border-slate-300 dark:focus-within:border-slate-700 focus-within:ring-1 focus-within:ring-slate-300 dark:focus-within:ring-slate-700/50 transition-all"
            >
                {/* File Upload Button */}
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-3 rounded-xl transition-colors ${selectedFile
                        ? 'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400'
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                    title="Attach Document"
                >
                    {selectedFile ? <CheckCircle size={20} /> : <Paperclip size={20} />}
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileSelect}
                    accept=".pdf,.docx,.txt"
                />

                {/* Note about file selection */}
                {selectedFile && (
                    <div className="absolute -top-10 left-0 bg-purple-50 text-purple-600 border border-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-500/20 text-xs px-3 py-1.5 rounded-full flex items-center gap-2">
                        <FileCheck size={12} />
                        <span>{selectedFile.name} attached</span>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                            className="hover:text-purple-800 dark:hover:text-white"
                        >
                            ×
                        </button>
                    </div>
                )}

                {/* Text Input */}
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit(e);
                        }
                    }}
                    placeholder="Message Copilot... (Drop a file to validate)"
                    className="flex-1 bg-transparent border-0 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-0 py-3 max-h-32 resize-none custom-scrollbar"
                    rows={1}
                />

                {/* Send Button */}
                <button
                    type="submit"
                    disabled={isLoading || (!input.trim() && !selectedFile)}
                    className="p-3 bg-gradient-to-tr from-cyan-600 to-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 disabled:shadow-none transition-all duration-200"
                >
                    <Send size={20} />
                </button>
            </form>
            <div className="text-center mt-3 text-xs text-slate-400 dark:text-slate-600 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2">
                <a
                    href="https://nozomtechs.com/ar"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                >
                    Powered by Nozom Consulting
                </a>
            </div>
        </div>
    );
};

export default MessageInput;
