import React, { useState, useMemo } from "react";
import { Modal } from "./Modal";
import type { Conversation } from "../types/chat";
import crossIcon from "../assets/crossWhiteIcon.svg";
import "../styles/SearchChatModal.scss";

interface SearchChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  onSelectConversation: (id: string) => void;
}

export const SearchChatModal: React.FC<SearchChatModalProps> = ({
  isOpen,
  onClose,
  conversations,
  onSelectConversation,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const getConversationTitle = (conversation: Conversation) => {
    if (conversation.title) return conversation.title;
    const firstMessage = conversation.messages[0];
    if (firstMessage && firstMessage.role === "user") {
      return (
        firstMessage.content.slice(0, 50) +
        (firstMessage.content.length > 50 ? "..." : "")
      );
    }
    return "New Chat";
  };

  const recentChats = useMemo(() => {
    return conversations.slice(0, 10);
  }, [conversations]);

  const filteredChats = useMemo(() => {
    return recentChats.filter((conv) => {
      const title = getConversationTitle(conv);
      return title.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [recentChats, searchQuery]);

  const handleSelectChat = (id: string) => {
    onSelectConversation(id);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Search Chats" size="md">
      <div className="search-modal-content">
        <div className="search-modal-input-wrapper">
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-modal-input"
            autoFocus
          />
          {searchQuery && (
            <button
              className="search-modal-clear"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              <img src={crossIcon} alt="Clear" />
            </button>
          )}
        </div>

        <div className="search-modal-list">
          {filteredChats.length > 0 ? (
            filteredChats.map((conversation) => (
              <div
                key={conversation.id}
                className="search-modal-item"
                onClick={() => handleSelectChat(conversation.id)}
              >
                <div className="search-modal-item-title">
                  {getConversationTitle(conversation)}
                </div>
                <div className="search-modal-item-preview">
                  {conversation.messages.length} messages
                </div>
              </div>
            ))
          ) : (
            <div className="search-modal-empty">
              {searchQuery ? "No chats found matching your search" : "No recent chats"}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
