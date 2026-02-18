import React from 'react';
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useLocale } from '../Context/LocaleContext';

const ChatHeader = ({ conversationTitle, onToggleSidebar, onNewChat, sidebarCollapsed, onToggleCollapse }) => {
    const { t, dir } = useLocale();

    return (
        <header className="h-14 border-b border-[var(--border-primary)] bg-[var(--surface-panel)] flex items-center shrink-0 transition-colors">
            {/* Left: Logo (desktop only, width animated to match sidebar) */}
            <div
                className={`hidden md:flex items-center justify-center shrink-0 h-full header-section-transition overflow-hidden ${dir === 'rtl' ? 'border-l' : 'border-r'} border-[var(--border-primary)]`}
                style={{ width: sidebarCollapsed ? '4rem' : '18rem' }}
            >
                {sidebarCollapsed ? (
                    <button
                        onClick={onToggleCollapse}
                        aria-label={t('chat.expandSidebar')}
                        className="flex items-center justify-center w-full h-full hover:bg-[var(--surface-subtle)] transition-colors cursor-pointer focus-ring"
                    >
                        <PanelLeftOpen size={20} className="app-muted flip-rtl" />
                    </button>
                ) : (
                    <>
                        <button
                            onClick={onNewChat}
                            aria-label={t('chat.newChat')}
                            className="flex items-center gap-3 px-4 h-full hover:bg-[var(--surface-subtle)] transition-colors cursor-pointer focus-ring shrink-0"
                        >
                            <div className="w-9 h-9 rounded-lg btn-primary flex items-center justify-center">
                                <span className="text-white font-bold text-sm">Q</span>
                            </div>
                            <span className="text-base font-semibold app-title whitespace-nowrap">{t('common.appName')}</span>
                        </button>
                        <button
                            onClick={onToggleCollapse}
                            className="p-1.5 rounded-lg btn-ghost ms-auto me-2 hidden md:flex focus-ring"
                            aria-label={t('chat.collapseSidebar')}
                            aria-expanded="true"
                        >
                            <PanelLeftClose size={18} className="flip-rtl" />
                        </button>
                    </>
                )}
            </div>

            {/* Right: hamburger (mobile) + expand button (desktop collapsed) + title */}
            <div className="flex-1 flex items-center gap-3 px-4 min-w-0">
                {/* Mobile hamburger */}
                <button
                    onClick={onToggleSidebar}
                    className="p-2 rounded-lg btn-ghost transition-colors md:hidden focus-ring"
                    aria-label={t('common.toggleSidebar')}
                >
                    <Menu size={20} />
                </button>

                {/* Conversation title */}
                <h2 className="text-sm font-semibold app-title truncate flex-1">
                    {conversationTitle || t('chat.newConversation')}
                </h2>
            </div>
        </header>
    );
};

export default ChatHeader;
