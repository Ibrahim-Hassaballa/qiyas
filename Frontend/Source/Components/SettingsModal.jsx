import React from 'react';
import { Settings, LayoutGrid, Database, AlignLeft, Sun, Moon, Brain, ToggleLeft, ToggleRight, Loader2, Plus, Trash2, Save } from 'lucide-react';

const SettingsModal = ({
    isOpen,
    onClose,
    activeTab,
    setActiveTab,
    theme,
    setTheme,
    isMemoryEnabled,
    toggleMemory,
    controls,
    controlInputRef,
    handleUploadControl,
    handleDeleteControl,
    isUploading,
    systemPrompt,
    setSystemPrompt,
    saveSettings,
    isSavingSettings
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 dark:bg-black/60 backdrop-blur-sm p-4 transition-colors">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl dark:shadow-slate-950/50 overflow-hidden flex flex-col max-h-[80vh] transition-colors">
                {/* Title Bar */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Settings size={18} /> Settings
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-800 dark:hover:text-white">✕</button>
                </div>

                {/* Tabs Header */}
                <div className="flex border-b border-slate-100 dark:border-slate-800">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'general' ? 'text-cyan-600 border-b-2 border-cyan-500 bg-cyan-50 dark:bg-cyan-500/5 dark:text-cyan-400' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50'}`}
                    >
                        <LayoutGrid size={16} /> General
                    </button>
                    <button
                        onClick={() => setActiveTab('kb')}
                        className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'kb' ? 'text-cyan-600 border-b-2 border-cyan-500 bg-cyan-50 dark:bg-cyan-500/5 dark:text-cyan-400' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50'}`}
                    >
                        <Database size={16} /> Knowledge Base
                    </button>
                    <button
                        onClick={() => setActiveTab('system')}
                        className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'system' ? 'text-cyan-600 border-b-2 border-cyan-500 bg-cyan-50 dark:bg-cyan-500/5 dark:text-cyan-400' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50'}`}
                    >
                        <AlignLeft size={16} /> System Prompt
                    </button>
                </div>

                {/* Tab Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">

                    {/* TAB 1: GENERAL */}
                    {activeTab === 'general' && (
                        <div className="space-y-6">

                            {/* Appearance Section */}
                            <div>
                                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Appearance</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setTheme('light')}
                                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${theme === 'light' ? 'bg-cyan-50 border-cyan-500 text-cyan-700 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600'}`}
                                    >
                                        <div className={`p-2 rounded-lg ${theme === 'light' ? 'bg-cyan-100 text-cyan-600' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                                            <Sun size={18} />
                                        </div>
                                        <div className="text-left">
                                            <div className="text-sm font-medium">Light Profile</div>
                                            <div className="text-[10px] opacity-70">Focus / Clean</div>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setTheme('dark')}
                                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${theme === 'dark' ? 'bg-slate-800 border-cyan-500 text-cyan-400 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600'}`}
                                    >
                                        <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-slate-900 text-cyan-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                                            <Moon size={18} />
                                        </div>
                                        <div className="text-left">
                                            <div className="text-sm font-medium">Dark Profile</div>
                                            <div className="text-[10px] opacity-70">Tech / Night</div>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Intelligence Section */}
                            <div>
                                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Intelligence</h4>
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 flex justify-between items-center transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${isMemoryEnabled ? 'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400' : 'bg-slate-200 text-slate-500 dark:bg-slate-700/50 dark:text-slate-500'}`}>
                                            <Brain size={20} />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">Context Memory</h4>
                                            <p className="text-xs text-slate-500">Enable multi-turn conversations</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={toggleMemory}
                                        className={`transition-colors ${isMemoryEnabled ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-500'}`}
                                    >
                                        {isMemoryEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                                    </button>
                                </div>
                            </div>

                        </div>
                    )}

                    {/* TAB 2: KNOWLEDGE BASE */}
                    {activeTab === 'kb' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-sm text-slate-500 dark:text-slate-400">{controls.length} Documents</span>
                                <button
                                    type="button"
                                    onClick={() => controlInputRef.current?.click()}
                                    disabled={isUploading}
                                    className="text-sm bg-cyan-100 text-cyan-700 hover:bg-cyan-200 dark:bg-cyan-600/20 dark:text-cyan-400 dark:hover:bg-cyan-600/30 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                                >
                                    {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                    Add Document
                                </button>
                                <input
                                    type="file"
                                    ref={controlInputRef}
                                    className="hidden"
                                    accept=".pdf,.docx,.txt"
                                    onChange={handleUploadControl}
                                />
                            </div>

                            <div className="space-y-2">
                                {controls.map((file, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-200 dark:bg-slate-800/50 dark:border-slate-700/50 rounded-xl transition-colors">
                                        <span className="text-sm text-slate-700 dark:text-slate-300 truncate max-w-[200px]" title={file}>{file}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteControl(file)}
                                            className="p-1.5 text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                                {controls.length === 0 && (
                                    <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                        No documents locally found.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB 3: SYSTEM PROMPT */}
                    {activeTab === 'system' && (
                        <div className="space-y-4 h-full flex flex-col">
                            <div className="bg-yellow-50 text-yellow-800 p-3 rounded-lg text-xs border border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-200 dark:border-yellow-700/50">
                                <strong>Warning:</strong> Modifying the system prompt drastically changes the AI's behavior. Keep the placeholders <code>{'{context_text}'}</code> and <code>{'{user_query}'}</code> intact if possible.
                            </div>
                            <textarea
                                value={systemPrompt}
                                onChange={(e) => setSystemPrompt(e.target.value)}
                                className="flex-1 w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs leading-relaxed resize-none focus:ring-2 focus:ring-cyan-500 outline-none custom-scrollbar"
                                placeholder="Enter system prompt..."
                            />
                            <button
                                onClick={saveSettings}
                                disabled={isSavingSettings}
                                className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                            >
                                {isSavingSettings ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                Save Changes
                            </button>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
