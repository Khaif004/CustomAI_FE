import React from 'react';
import type { Conversation } from '../types/chat';
import '../styles/chatbot.css';

interface ConversationSidebarProps {
  conversations: Conversation[];
  currentId: string;
  isOpen: boolean;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onClearAll: () => void;
  onToggle: () => void;
}

export const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  conversations,
  currentId,
  isOpen,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onClearAll,
  onToggle,
}) => {
  const formatDate = (date: Date) => {
    const d = new Date(date);
    const today = new Date();
    
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Group conversations by date
  const groupedConversations = React.useMemo(() => {
    const groups: { [key: string]: Conversation[] } = {
      'Today': [],
      'Yesterday': [],
      'This Week': [],
      'Older': [],
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    conversations.forEach(conv => {
      const convDate = new Date(conv.updatedAt);
      const convDay = new Date(convDate.getFullYear(), convDate.getMonth(), convDate.getDate());

      if (convDay.getTime() === today.getTime()) {
        groups['Today'].push(conv);
      } else if (convDay.getTime() === yesterday.getTime()) {
        groups['Yesterday'].push(conv);
      } else if (convDay.getTime() > weekAgo.getTime()) {
        groups['This Week'].push(conv);
      } else {
        groups['Older'].push(conv);
      }
    });

    return groups;
  }, [conversations]);

  return (
    <>
      {/* Mobile toggle button */}
      <button className="sidebar-toggle" onClick={onToggle}>
        <span className="toggle-icon">☰</span>
      </button>

      {/* Sidebar */}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h1 className="app-title">ChatBot</h1>
        </div>

        {/* New Chat Button */}
        <button className="new-chat-btn" onClick={onNewConversation}>
          <span className="plus-icon">+</span>
          New Chat
        </button>

        {/* Conversations List */}
        <div className="conversations-list">
          {conversations.length === 0 ? (
            <div className="empty-state">
              <p>No conversations yet</p>
              <p className="subtitle">Start a new chat to begin</p>
            </div>
          ) : (
            Object.entries(groupedConversations).map(([group, convs]) => {
              if (convs.length === 0) return null;
              
              return (
                <div key={group} className="conversation-group">
                  <div className="group-label">{group}</div>
                  {convs.map(conv => (
                    <div key={conv.id} className="conversation-item-wrapper">
                      <button
                        className={`conversation-item ${
                          conv.id === currentId ? 'active' : ''
                        }`}
                        onClick={() => onSelectConversation(conv.id)}
                        title={conv.title}
                      >
                        <span className="conv-title">{conv.title}</span>
                        <span className="conv-date">{formatDate(new Date(conv.updatedAt))}</span>
                      </button>
                      <button
                        className="delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(conv.id);
                        }}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {conversations.length > 0 && (
          <div className="sidebar-footer">
            <button className="clear-all-btn" onClick={onClearAll} title="Delete all conversations">
              🗑️ Clear All
            </button>
          </div>
        )}
      </aside>

      {/* Overlay for mobile */}
      {isOpen && <div className="sidebar-overlay" onClick={onToggle} />}
    </>
  );
};
