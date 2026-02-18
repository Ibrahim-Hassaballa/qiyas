import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UserProfileMenu from '../Components/UserProfileMenu';
import { LocaleProvider } from '../Context/LocaleContext';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const renderMenu = (props = {}, { initialRoute = '/' } = {}) => {
  const defaults = {
    user: { username: 'Alice', role: 'member', cost_limit: 0, cost_used: 0 },
    logout: vi.fn(),
    onOpenSettings: vi.fn(),
  };
  const merged = { ...defaults, ...props };
  return render(
    <LocaleProvider>
      <MemoryRouter initialEntries={[initialRoute]}>
        <UserProfileMenu {...merged} />
      </MemoryRouter>
    </LocaleProvider>
  );
};

describe('UserProfileMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders user avatar with correct initial', () => {
    renderMenu();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders username and role', () => {
    renderMenu();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();
  });

  it('dropdown is closed by default', () => {
    renderMenu();
    const menu = screen.getByRole('menu');
    expect(menu).toHaveClass('pointer-events-none');
  });

  it('clicking profile opens dropdown', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { expanded: false });
    fireEvent.click(trigger);
    const menu = screen.getByRole('menu');
    expect(menu).not.toHaveClass('pointer-events-none');
  });

  it('clicking outside closes dropdown', () => {
    renderMenu();
    // Open
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByRole('menu')).not.toHaveClass('pointer-events-none');
    // Click outside
    fireEvent.mouseDown(document.body);
    expect(screen.getByRole('menu')).toHaveClass('pointer-events-none');
  });

  it('escape key closes dropdown', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByRole('menu')).not.toHaveClass('pointer-events-none');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('menu')).toHaveClass('pointer-events-none');
  });

  it('settings menu item calls onOpenSettings', () => {
    const onOpenSettings = vi.fn();
    renderMenu({ onOpenSettings });
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    fireEvent.click(screen.getByRole('menuitem', { name: /settings/i }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('sign out menu item calls logout', () => {
    const logout = vi.fn();
    renderMenu({ logout });
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    fireEvent.click(screen.getByRole('menuitem', { name: /sign out/i }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('admin dashboard shows only for admin/owner roles', () => {
    // Member — no dashboard
    const { unmount } = renderMenu({ user: { username: 'Bob', role: 'member' } });
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.queryByRole('menuitem', { name: /dashboard/i })).not.toBeInTheDocument();
    unmount();

    // Admin — dashboard visible
    renderMenu({ user: { username: 'Admin', role: 'admin' } });
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByRole('menuitem', { name: /dashboard/i })).toBeInTheDocument();
  });

  it('admin dashboard navigates to /admin', () => {
    renderMenu({ user: { username: 'Owner', role: 'owner' } });
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    fireEvent.click(screen.getByRole('menuitem', { name: /dashboard/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/admin');
  });

  it('hides Dashboard when on /admin route', () => {
    renderMenu(
      { user: { username: 'Admin', role: 'admin' } },
      { initialRoute: '/admin' }
    );
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.queryByRole('menuitem', { name: /dashboard/i })).not.toBeInTheDocument();
    // Settings and Sign Out should still be present
    expect(screen.getByRole('menuitem', { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /sign out/i })).toBeInTheDocument();
  });

  it('shows Dashboard when NOT on /admin route', () => {
    renderMenu(
      { user: { username: 'Admin', role: 'admin' } },
      { initialRoute: '/' }
    );
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByRole('menuitem', { name: /dashboard/i })).toBeInTheDocument();
  });

  it('usage section shows when cost_limit > 0, hidden when 0', () => {
    // No usage — cost_limit is 0
    const { unmount } = renderMenu({
      user: { username: 'X', role: 'member', cost_limit: 0, cost_used: 0 },
    });
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.queryByText(/cost usage/i)).not.toBeInTheDocument();
    unmount();

    // With usage
    renderMenu({
      user: { username: 'Y', role: 'member', cost_limit: 100, cost_used: 42 },
    });
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByText(/cost usage/i)).toBeInTheDocument();
  });
});
