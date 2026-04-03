import { useState, useEffect } from "react";
import type { Conversation } from "../types/chat";
import NewChatIcon from "../assets/newWhiteIcon.svg?react";
import SearchIcon from "../assets/searchWhiteIcon.svg?react";
import MoreDotsIcon from "../assets/moreDotsIcon.svg?react";
import EditIcon from "../assets/editIcon.svg?react";
import PinIcon from "../assets/pinIcon.svg?react";
import DeleteIcon from "../assets/deleteIcon.svg?react";
import SidebarIcon from "../assets/sidebarIcon.svg?react";
import { SearchChatModal } from "./SearchChatModal";

interface ConversationSidebarProps {
  conversations: Conversation[];
  currentId: string;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  onDeleteConversation: (id: string) => void;
  onClearAll: () => void;
  width?: number;
}

export const ConversationSidebar = ({
  conversations,
  currentId,
  onNewChat,
  onSelectConversation,
  isOpen,
  onToggle,
  onDeleteConversation,
  width,
}: ConversationSidebarProps) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
  }>({ top: 0, left: 0 });
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if clicked outside any menu
      const dropdowns = document.querySelectorAll(".dropdown-menu");
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
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openMenuId]);

  const getConversationTitle = (conversation: Conversation) => {
    if (conversation.title) return conversation.title;
    const firstMessage = conversation.messages[0];
    if (firstMessage && firstMessage.role === "user") {
      return (
        firstMessage.content.slice(0, 30) +
        (firstMessage.content.length > 30 ? "..." : "")
      );
    }
    return "New Chat";
  };

  return (
    <aside className={`sidebar ${isOpen ? "open" : ""}`} style={width ? { width: `${width}px` } : undefined}>
      <div className="sidebar-header">
        <div className="sidebar-header-top">
          <a className="icon-menu-item" onClick={onNewChat} title="New chat">
            <NewChatIcon />
            <span>New chat</span>
          </a>
          <button className="sidebar-collapse-btn" onClick={onToggle} title="Close sidebar">
            <SidebarIcon />
          </button>
        </div>
        <div className="sidebar-icon-menu">
          <a className="icon-menu-item" onClick={() => setIsSearchModalOpen(true)} title="Search chats">
            <SearchIcon />
            <span>Search chats</span>
          </a>
        </div>
      </div>

      <div className="sidebar-content">
        <div className="conversation-list">
          {conversations.length > 0 ? (
            [...conversations]
              .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
              .map((conversation) => (
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

              <div className="conversation-item-menu">
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
                    setOpenMenuId(
                      openMenuId === conversation.id ? null : conversation.id,
                    );
                  }}
                  title="More options"
                >
                  <MoreDotsIcon />
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
                        console.log("Rename:", conversation.id);
                        setOpenMenuId(null);
                      }}
                    >
                      <EditIcon />
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
                      <PinIcon />
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
                      <DeleteIcon />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
            ))
          ) : (
            <div className="no-conversations">
              {/* <p>No chats yet</p> */}
            </div>
          )}
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

      <SearchChatModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        conversations={conversations}
        onSelectConversation={onSelectConversation}
      />
    </aside>
  );
};
