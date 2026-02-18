import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UserProfileMenu from '../Components/UserProfileMenu';
import ChatSidebar from '../Components/ChatSidebar';
import AdminSidebar from '../Components/Admin/AdminSidebar';
import { LocaleProvider } from '../Context/LocaleContext';

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// Mock AuthContext
vi.mock('../Context/AuthContext', () => ({
  useAuth: () => ({
    user: { username: 'TestUser', role: 'member', cost_limit: 0, cost_used: 0 },
    logout: vi.fn(),
  }),
}));

// Mock api module
vi.mock('../Services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

const wrap = (ui) => (
  <LocaleProvider>
    <MemoryRouter>{ui}</MemoryRouter>
  </LocaleProvider>
);

// ─── UserProfileMenu ────────────────────────────────────────────────────────

describe('UserProfileMenu — collapsed mode', () => {
  const baseProps = {
    user: { username: 'Alice', role: 'member', cost_limit: 0, cost_used: 0 },
    logout: vi.fn(),
    onOpenSettings: vi.fn(),
  };

  it('renders avatar-only when collapsed — no username, no chevron', () => {
    render(wrap(<UserProfileMenu {...baseProps} collapsed />));
    // Avatar initial should be present
    expect(screen.getByText('A')).toBeInTheDocument();
    // Username and role text should NOT be present
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    expect(screen.queryByText('Member')).not.toBeInTheDocument();
  });

  it('renders full card when collapsed={false} — avatar, username, role, chevron', () => {
    render(wrap(<UserProfileMenu {...baseProps} collapsed={false} />));
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();
  });

  it('popup opens correctly in collapsed mode', () => {
    render(wrap(<UserProfileMenu {...baseProps} collapsed />));
    const trigger = screen.getByRole('button', { expanded: false });
    fireEvent.click(trigger);
    const menu = screen.getByRole('menu');
    expect(menu).not.toHaveClass('pointer-events-none');
  });

  it('popup has fixed class when collapsed and open', () => {
    render(wrap(<UserProfileMenu {...baseProps} collapsed />));
    const trigger = screen.getByRole('button', { expanded: false });
    fireEvent.click(trigger);
    const menu = screen.getByRole('menu');
    expect(menu).toHaveClass('fixed');
  });
});

// ─── ChatSidebar ────────────────────────────────────────────────────────────

describe('ChatSidebar — collapse behavior', () => {
  const baseProps = {
    onSelectConversation: vi.fn(),
    onNewChat: vi.fn(),
    activeConversationId: null,
    refreshTrigger: 0,
    onOpenSettings: vi.fn(),
    isSidebarOpen: false,
    onCloseSidebar: vi.fn(),
  };

  it('renders w-16 container when isCollapsed={true}', () => {
    const { container } = render(wrap(<ChatSidebar {...baseProps} isCollapsed />));
    // The desktop sidebar div (hidden md:flex)
    const desktopSidebar = container.querySelector('.sidebar-transition');
    expect(desktopSidebar).toBeInTheDocument();
    expect(desktopSidebar).toHaveClass('w-16');
    expect(desktopSidebar).not.toHaveClass('w-72');
  });

  it('renders w-72 container when isCollapsed={false}', () => {
    const { container } = render(wrap(<ChatSidebar {...baseProps} isCollapsed={false} />));
    const desktopSidebar = container.querySelector('.sidebar-transition');
    expect(desktopSidebar).toBeInTheDocument();
    expect(desktopSidebar).toHaveClass('w-72');
    expect(desktopSidebar).not.toHaveClass('w-16');
  });

  it('collapsed rail has New Chat and Conversations buttons', () => {
    render(wrap(<ChatSidebar {...baseProps} isCollapsed />));
    expect(screen.getByRole('button', { name: /new chat/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search conversations/i })).toBeInTheDocument();
  });
});

// ─── AdminSidebar ───────────────────────────────────────────────────────────

describe('AdminSidebar — uses collapsed prop (not internal state)', () => {
  const baseProps = {
    activeTab: 'overview',
    onTabChange: vi.fn(),
    user: { username: 'Admin', role: 'owner', cost_limit: 0, cost_used: 0 },
    isOpen: false,
    onClose: vi.fn(),
    onOpenSettings: vi.fn(),
  };

  it('renders w-16 sidebar when collapsed={true}', () => {
    const { container } = render(wrap(<AdminSidebar {...baseProps} collapsed />));
    const desktopSidebar = container.querySelector('.sidebar-transition');
    expect(desktopSidebar).toBeInTheDocument();
    expect(desktopSidebar).toHaveClass('w-16');
    expect(desktopSidebar).not.toHaveClass('w-60');
  });

  it('renders w-60 sidebar when collapsed={false}', () => {
    const { container } = render(wrap(<AdminSidebar {...baseProps} collapsed={false} />));
    const desktopSidebar = container.querySelector('.sidebar-transition');
    expect(desktopSidebar).toBeInTheDocument();
    expect(desktopSidebar).toHaveClass('w-60');
    expect(desktopSidebar).not.toHaveClass('w-16');
  });
});
