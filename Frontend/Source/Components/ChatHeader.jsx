import React from 'react';
import { Shield, Settings, LogOut } from 'lucide-react';

const ChatHeader = ({ user, logout, onOpenSettings }) => {
    return (
        <header className="px-8 py-6 border-b border-slate-200 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/30 backdrop-blur-xl sticky top-0 z-10 flex justify-between items-center transition-colors">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-cyan-100 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400`}>
                    <Shield size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
                        Qiyas AI
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Intelligent Compliance & Regulations Assistant
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {user && (
                    <div className="hidden sm:flex flex-col items-end mr-4">
                        <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Logged in as</span>
                        <span className="text-sm text-slate-700 dark:text-slate-200 font-medium">{user.username}</span>
                    </div>
                )}

                <button
                    onClick={logout}
                    className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:text-slate-400 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Sign Out"
                >
                    <LogOut size={20} />
                </button>

                <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-2"></div>

                <button
                    onClick={onOpenSettings}
                    className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title="Settings"
                >
                    <Settings size={24} />
                </button>
            </div>
        </header>
    );
};

export default ChatHeader;
