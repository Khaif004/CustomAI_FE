import { useState, useEffect } from "react";
import type { Conversation } from "../types/chat";

interface ConversationSidebarProps {
  conversations: Conversation[];
  currentId: string;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  onDeleteConversation: (id: string) => void;
  onClearAll: () => void;
}

export const ConversationSidebar = ({
  conversations,
  currentId,
  onNewChat,
  onSelectConversation,
  isOpen,
  onDeleteConversation,
}: ConversationSidebarProps) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if clicked outside any menu
      const dropdowns = document.querySelectorAll('.dropdown-menu');
      let clickedInMenu = false;
      dropdowns.forEach((dropdown) => {
        if (dropdown.contains(event.target as Node)) {
          clickedInMenu = true;
        }
      });
      
      if (!clickedInMenu) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openMenuId]);
  const getConversationTitle = (conversation: Conversation) => {
    if (conversation.title) return conversation.title;
    const firstMessage = conversation.messages[0];
    if (firstMessage && firstMessage.role === "user") {
      return firstMessage.content.slice(0, 30) + (firstMessage.content.length > 30 ? "..." : "");
    }
    return "New Chat";
  };

  return (
    <aside className={`sidebar ${isOpen ? "open" : ""}`}>
      <div className="sidebar-header">
        <button className="new-chat-btn" onClick={onNewChat}>
          <svg viewBox="0 0 24 24">
            <path d="M12 5v14m-7-7h14" />
          </svg>
          New chat
        </button>
      </div>

      <div className="sidebar-content">
        <div className="conversation-list">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`conversation-item ${
                conversation.id === currentId ? "active" : ""
              } ${openMenuId === conversation.id ? "menu-open" : ""}`}
              onClick={() => onSelectConversation(conversation.id)}
            >
              {/* <svg viewBox="0 0 24 24">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg> */}
              <span>{getConversationTitle(conversation)}</span>
              
              <div 
                className="conversation-item-menu"
              >
                <button
                  className="menu-trigger"
                  onClick={(e) => {
                    e.stopPropagation();
                    const button = e.currentTarget as HTMLButtonElement;
                    const rect = button.getBoundingClientRect();
                    setMenuPosition({
                      top: rect.bottom + 4,
                      left: rect.left,
                    });
                    setOpenMenuId(openMenuId === conversation.id ? null : conversation.id);
                  }}
                  title="More options"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
                    <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
                    <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
                  </svg>
                </button>
                
                {openMenuId === conversation.id && (
                  <div 
                    className="dropdown-menu"
                    style={{
                      top: `${menuPosition.top}px`,
                      left: `${menuPosition.left}px`,
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Implement rename
                        console.log("Rename:", conversation.id);
                        setOpenMenuId(null);
                      }}
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      Rename
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Implement pin
                        console.log("Pin:", conversation.id);
                        setOpenMenuId(null);
                      }}
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M12 17V3m0 0L7 8m5-5l5 5M5 17h14" />
                      </svg>
                      Pin
                    </button>
                    <button
                      className="danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(conversation.id);
                        setOpenMenuId(null);
                      }}
                    >
                      <svg viewBox="0 0 24 24">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-avatar">U</div>
          <div className="user-info">
            <div className="user-name">User</div>
            <div className="user-status">Free plan</div>
          </div>
        </div>
      </div>
    </aside>
  );
};