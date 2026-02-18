import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChatHeader from '../Components/ChatHeader';
import { LocaleProvider } from '../Context/LocaleContext';

const renderHeader = (props = {}) => {
  const defaults = {
    conversationTitle: 'Test Conversation',
    onToggleSidebar: vi.fn(),
    onNewChat: vi.fn(),
  };
  const merged = { ...defaults, ...props };
  return render(
    <LocaleProvider>
      <MemoryRouter>
        <ChatHeader {...merged} />
      </MemoryRouter>
    </LocaleProvider>
  );
};

describe('ChatHeader', () => {
  it('renders conversation title', () => {
    renderHeader({ conversationTitle: 'My Chat' });
    expect(screen.getByText('My Chat')).toBeInTheDocument();
  });

  it('does not render logout or dashboard icons', () => {
    renderHeader();
    expect(screen.queryByLabelText(/sign out/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/dashboard/i)).not.toBeInTheDocument();
  });

  it('hamburger calls onToggleSidebar', () => {
    const onToggleSidebar = vi.fn();
    renderHeader({ onToggleSidebar });
    fireEvent.click(screen.getByLabelText(/toggle sidebar/i));
    expect(onToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it('logo click calls onNewChat', () => {
    const onNewChat = vi.fn();
    renderHeader({ onNewChat });
    fireEvent.click(screen.getByLabelText(/new chat/i));
    expect(onNewChat).toHaveBeenCalledTimes(1);
  });
});
