import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { Conversation, User } from "../types/chat";
import NewChatIcon from "../assets/newWhiteIcon.svg?react";
import SearchIcon from "../assets/searchWhiteIcon.svg?react";
import MoreDotsIcon from "../assets/moreDotsIcon.svg?react";
import EditIcon from "../assets/editIcon.svg?react";
import PinIcon from "../assets/pinIcon.svg?react";
import DeleteIcon from "../assets/deleteIcon.svg?react";
import SidebarIcon from "../assets/sidebarIcon.svg?react";
import HamburgerMenuIcon from "../assets/hamburgerMenuIcon.svg?react";
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
  onRenameConversation: (id: string, title: string) => void;
  onTogglePin: (id: string) => void;
  width?: number;
  onLogout?: () => void;
  user?: User | null;
}

export const ConversationSidebar = ({
  conversations,
  currentId,
  onNewChat,
  onSelectConversation,
  isOpen,
  onToggle,
  onDeleteConversation,
  onRenameConversation,
  onTogglePin,
  width,
  onLogout,
  user,
}: ConversationSidebarProps) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
  }>({ top: 0, left: 0 });
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const commitRename = (id: string) => {
    if (editingId !== id) return;
    const trimmed = editingTitle.trim();
    if (trimmed) onRenameConversation(id, trimmed);
    setEditingId(null);
    setEditingTitle("");
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const dropdowns = document.querySelectorAll(".dropdown-menu");
      let clickedInMenu = false;
      dropdowns.forEach((dropdown) => {
        if (dropdown.contains(event.target as Node)) {
          clickedInMenu = true;
        }
      });
      if (!clickedInMenu) setOpenMenuId(null);
    };

    if (openMenuId) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openMenuId]);

  const userName = user?.display_name || user?.username || "User";
  const userInitial = userName.trim().charAt(0).toUpperCase() || "U";
  // Prefer the email as the secondary line; fall back to the username when it
  // differs from the name we're already showing.
  const userSubtitle =
    user?.email ||
    (user?.username && user.username !== userName ? user.username : "");

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
    <aside
      className={`sidebar ${isOpen ? "open" : ""}`}
      style={isOpen && width ? { width: `${width}px` } : undefined}
    >
      {/* ── Collapsed icon strip ── */}
      <div className="sidebar-collapsed-strip" aria-hidden={isOpen}>
        <button
          className="sidebar-icon-btn"
          onClick={onToggle}
          title="Open sidebar"
        >
          <HamburgerMenuIcon />
        </button>

        <div className="sidebar-icon-divider" />

        <button
          className="sidebar-icon-btn"
          onClick={onNewChat}
          title="New chat"
        >
          <NewChatIcon />
        </button>
        <button
          className="sidebar-icon-btn"
          onClick={() => setIsSearchModalOpen(true)}
          title="Search chats"
        >
          <SearchIcon />
        </button>
      </div>

      {/* ── Full sidebar content ── */}
      <div className="sidebar-full">
        <div className="sidebar-header">
          <div className="sidebar-header-top">
            <a className="icon-menu-item" onClick={onNewChat} title="New chat">
              <NewChatIcon />
              <span>New chat</span>
            </a>
            <button
              className="sidebar-collapse-btn"
              onClick={onToggle}
              title="Close sidebar"
            >
              <SidebarIcon />
            </button>
          </div>
          <div className="sidebar-icon-menu">
            <a
              className="icon-menu-item"
              onClick={() => setIsSearchModalOpen(true)}
              title="Search chats"
            >
              <SearchIcon />
              <span>Search chats</span>
            </a>
          </div>
        </div>

        <div className="sidebar-content">
          <div className="conversation-list">
            {conversations.length > 0 ? (
              [...conversations]
                .sort((a, b) => {
                  // Pinned conversations always sort above unpinned ones;
                  // within each group, most-recently-updated first.
                  const ap = a.pinned ? 1 : 0;
                  const bp = b.pinned ? 1 : 0;
                  if (ap !== bp) return bp - ap;
                  return (
                    new Date(b.updatedAt).getTime() -
                    new Date(a.updatedAt).getTime()
                  );
                })
                .map((conversation) => (
                  <div
                    key={conversation.id}
                    className={`conversation-item ${
                      conversation.id === currentId ? "active" : ""
                    } ${openMenuId === conversation.id ? "menu-open" : ""} ${
                      conversation.pinned ? "pinned" : ""
                    }`}
                    onClick={() => {
                      if (editingId === conversation.id) return;
                      onSelectConversation(conversation.id);
                    }}
                  >
                    {editingId === conversation.id ? (
                      <input
                        className="conversation-rename-input"
                        autoFocus
                        value={editingTitle}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitRename(conversation.id);
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            cancelRename();
                          }
                        }}
                        onBlur={() => commitRename(conversation.id)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          font: "inherit",
                          color: "inherit",
                          background: "transparent",
                          border: "none",
                          borderBottom: "1px solid currentColor",
                          outline: "none",
                          padding: 0,
                        }}
                      />
                    ) : (
                      <span>
                        {conversation.pinned && (
                          <span
                            className="conversation-pin-indicator"
                            aria-label="Pinned"
                            style={{
                              display: "inline-flex",
                              verticalAlign: "middle",
                              marginRight: 4,
                            }}
                          >
                            <PinIcon width={12} height={12} />
                          </span>
                        )}
                        {getConversationTitle(conversation)}
                      </span>
                    )}

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
                            openMenuId === conversation.id
                              ? null
                              : conversation.id,
                          );
                        }}
                        title="More options"
                      >
                        <MoreDotsIcon />
                      </button>

                      {openMenuId === conversation.id &&
                        createPortal(
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
                                setEditingId(conversation.id);
                                setEditingTitle(
                                  getConversationTitle(conversation),
                                );
                                setOpenMenuId(null);
                              }}
                            >
                              <EditIcon />
                              Rename
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onTogglePin(conversation.id);
                                setOpenMenuId(null);
                              }}
                            >
                              <PinIcon />
                              {conversation.pinned ? "Unpin" : "Pin"}
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
                          </div>,
                          document.body
                        )}
                    </div>
                  </div>
                ))
            ) : (
              <div className="no-conversations" />
            )}
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">{userInitial}</div>
            <div className="user-info">
              <div className="user-name" title={userName}>
                {userName}
              </div>
              {userSubtitle && (
                <div className="user-status" title={userSubtitle}>
                  {userSubtitle}
                </div>
              )}
            </div>
            {onLogout && (
              <button className="logout-btn" onClick={onLogout} title="Log out">
                Logout
              </button>
            )}
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
