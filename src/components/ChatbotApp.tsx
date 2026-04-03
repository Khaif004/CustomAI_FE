import { useState, useRef, useEffect } from "react";
import { ConversationSidebar } from "./ConversationSidebar";
import { ChatMessage } from "./ChatMessage";
import { useChatbot } from "../hooks/useChatbot";
import SettingsGearIcon from "../assets/settingsGearIcon.svg?react";
import AttachIcon from "../assets/attachIcon.svg?react";
import SendIcon from "../assets/sendIcon.svg?react";
import StopIcon from "../assets/stopIcon.svg?react";
import "../styles/ChatbotApp.scss";
import "../styles/ChatMessage.scss";
import "../styles/ConversationSidebar.scss";

export const ChatbotApp = () => {
  const {
    conversations,
    currentConversation,
    isLoading,
    isStreaming,
    isAuthenticated,
    sendMessage,
    newConversation,
    deleteConversation,
    clearAll,
    setCurrentConversationId,
    authenticate,
    error,
    stopGenerating,
    editMessage,
    regenerateLastResponse,
    reactToMessage,
  } = useChatbot();

  const [inputValue, setInputValue] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(!isAuthenticated);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-authenticate on mount or when token expires
  useEffect(() => {
    if (!isAuthenticated) {
      setShowAuthPrompt(true);
    }
  }, [isAuthenticated]);

  const handleLogin = async () => {
    try {
      await authenticate();
      setShowAuthPrompt(false);
    } catch (err) {
      console.error("Login failed:", err);
      // Error from authenticate hook will be shown in the modal
    }
  };

  const scrollToBottom = () => {
    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      const container = messagesContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  };

  // Auto-scroll during streaming and on new messages
  const lastMessage = currentConversation.messages[currentConversation.messages.length - 1];
  useEffect(() => {
    scrollToBottom();
  }, [currentConversation.messages, isLoading, lastMessage?.content]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const message = inputValue.trim();
    setInputValue("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "24px";
    }

    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);

    if (textareaRef.current) {
      textareaRef.current.style.height = "24px";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleNewChat = () => {
    newConversation();
    setInputValue("");
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    textareaRef.current?.focus();
  };

  const suggestions = [
    {
      title: "Explain a concept",
      text: "How does machine learning work?",
    },
    {
      title: "Write code",
      text: "Create a React component for a button",
    },
    // {
    //   title: "Get help",
    //   text: "What can you help me with?",
    // },
    // {
    //   title: "Analyze data",
    //   text: "Help me understand this dataset",
    // },
  ];

  return (
    <div className="chatbot-app">
      {showAuthPrompt && (
        <div className="auth-overlay">
          <div className="auth-modal">
            <div className="auth-header">
              <div className="auth-icon">AI</div>
              <h1>Welcome to ChatBot</h1>
            </div>
            <p className="auth-description">
              Sign in to start chatting and access your conversation history.
            </p>
            <button className="auth-button" onClick={handleLogin}>
              Sign In
            </button>
            {error && <div className="auth-error">{error}</div>}
          </div>
        </div>
      )}

      <ConversationSidebar
        conversations={conversations}
        currentId={currentConversation.id}
        onNewChat={handleNewChat}
        onSelectConversation={(id: string) => {
          setCurrentConversationId(id);
          setSidebarOpen(false);
        }}
        onDeleteConversation={deleteConversation}
        onClearAll={clearAll}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="chat-main">
        <div className="chat-header">
          <div className="chat-title">
            {currentConversation.title || "New Chat"}
          </div>
          <div className="chat-actions">
            <button className="icon-btn" title="Settings">
              <SettingsGearIcon />
            </button>
          </div>
        </div>

        <div className="messages-container" ref={messagesContainerRef}>
          {currentConversation.messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">AI</div>
              <h2>How can I help you today?</h2>
              <p>
                I'm here to assist you with questions, coding, writing,
                analysis, and more. Start a conversation below.
              </p>
              <div className="suggestions">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="suggestion-card"
                    onClick={() => handleSuggestionClick(suggestion.text)}
                  >
                    <h4>{suggestion.title}</h4>
                    <p>{suggestion.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages-wrapper">
              {currentConversation.messages.map((message: any, index: number) => {
                const isLastMessage = index === currentConversation.messages.length - 1;
                const isMessageStreaming = isLastMessage && isStreaming && message.role === 'assistant';
                // Find the last assistant message index
                const lastAssistantIdx = currentConversation.messages.findLastIndex(
                  (m: any) => m.role === 'assistant',
                );
                const isLastAssistant = index === lastAssistantIdx;
                return (
                  <ChatMessage 
                    key={message.id} 
                    message={message}
                    isStreaming={isMessageStreaming}
                    isLastAssistant={isLastAssistant}
                    onEdit={editMessage}
                    onRegenerate={regenerateLastResponse}
                    onReact={reactToMessage}
                  />
                );
              })}
              {isLoading && !isStreaming && currentConversation.messages.length > 0 && currentConversation.messages[currentConversation.messages.length - 1]?.role === 'user' && (
                <div className="loading-message">
                  <div className="loading-indicator">
                    <span className="loading-text">Thinking</span>
                    <div className="loading-spinner"></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="input-area">
          <div className="input-wrapper">
            <form onSubmit={handleSubmit}>
              <div className="input-container">
                <textarea
                  ref={textareaRef}
                  className="message-input"
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Message AI..."
                  rows={1}
                  disabled={isLoading}
                />
                <div className="input-actions">
                  <button
                    type="button"
                    className="attach-btn"
                    title="Attach file"
                  >
                    <AttachIcon />
                  </button>
                  {isStreaming ? (
                    <button
                      type="button"
                      className="stop-btn"
                      onClick={stopGenerating}
                      title="Stop generating"
                    >
                      <StopIcon />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="send-btn"
                      disabled={!inputValue.trim() || isLoading}
                      title="Send message"
                    >
                      <SendIcon />
                    </button>
                  )}
                </div>
              </div>
            </form>
            <div className="input-hint">
              Press Enter to send, Shift + Enter for new line
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
