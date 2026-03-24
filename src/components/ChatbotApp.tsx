import { useState, useRef, useEffect } from "react";
import { ConversationSidebar } from "./ConversationSidebar";
import { ChatMessage } from "./ChatMessage";
import { useChatbot } from "../hooks/useChatbot";
import "../styles/chatbot.css";

export const ChatbotApp = () => {
  const {
    conversations,
    currentConversation,
    isLoading,
    isAuthenticated,
    sendMessage,
    newConversation,
    deleteConversation,
    clearAll,
    setCurrentConversationId,
    authenticate,
    error,
  } = useChatbot();

  const [inputValue, setInputValue] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(!isAuthenticated);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-authenticate on mount
  useEffect(() => {
    if (!isAuthenticated && !showAuthPrompt) {
      setShowAuthPrompt(true);
    }
  }, [isAuthenticated, showAuthPrompt]);

  useEffect(() => {
    if (error?.includes('401') || error?.includes('Unauthorized')) {
      setShowAuthPrompt(true);
    }
  }, [error]);

  const handleLogin = async () => {
    try {
      await authenticate();
      setShowAuthPrompt(false);
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentConversation.messages]);

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
    
    // Auto-resize textarea
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
    {
      title: "Get help",
      text: "What can you help me with?",
    },
    {
      title: "Analyze data",
      text: "Help me understand this dataset",
    },
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
            <button 
              className="auth-button" 
              onClick={handleLogin}
            >
              Sign In
            </button>
            {error && (
              <div className="auth-error">
                {error}
              </div>
            )}
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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="messages-container">
          {currentConversation.messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">AI</div>
              <h2>How can I help you today?</h2>
              <p>
                I'm here to assist you with questions, coding, writing, analysis, and more.
                Start a conversation below.
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
              {currentConversation.messages.map((message: any) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {isLoading && (
                <div className="loading-message">
                  <div className="message-avatar">AI</div>
                  <div className="loading-dots">
                    <div className="loading-dot"></div>
                    <div className="loading-dot"></div>
                    <div className="loading-dot"></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
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
                    <svg viewBox="0 0 24 24">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>
                  <button
                    type="submit"
                    className="send-btn"
                    disabled={!inputValue.trim() || isLoading}
                    title="Send message"
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                    </svg>
                  </button>
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