import { useState, useRef, useEffect, useCallback } from "react";
import { ConversationSidebar } from "./ConversationSidebar";
import { ChatMessage } from "./ChatMessage";
import { useChatbot } from "../hooks/useChatbot";
import { navigate } from "./Router";
import SettingsGearIcon from "../assets/settingsGearIcon.svg?react";
import AttachIcon from "../assets/attachIcon.svg?react";
import SendIcon from "../assets/sendIcon.svg?react";
import StopIcon from "../assets/stopIcon.svg?react";
import CrossIcon from "../assets/crossIcon.svg?react";
import AppLogoIcon from "../assets/appLogoIcon.svg?react";
import SunIcon from "../assets/sunIcon.svg?react";
import MoonIcon from "../assets/moonIcon.svg?react";
import ChevronDownIcon from "../assets/chevronDownIcon.svg?react";
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
    sendMessageWithFile,
    newConversation,
    deleteConversation,
    clearAll,
    setCurrentConversationId,
    logout,
    stopGenerating,
    editMessage,
    regenerateLastResponse,
    reactToMessage,
  } = useChatbot();

  const [inputValue, setInputValue] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const isResizing = useRef(false);
  const userScrolledUp = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.min(Math.max(e.clientX, 180), 480);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (!isResizing.current) return;
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated]);



  const isNearBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    return container.scrollHeight - container.scrollTop - container.clientHeight < 100;
  }, []);

  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  }, []);

  const handleScroll = useCallback(() => {
    const nearBottom = isNearBottom();
    userScrolledUp.current = !nearBottom;
    setShowScrollBtn(!nearBottom);
  }, [isNearBottom]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const lastMessage = currentConversation.messages[currentConversation.messages.length - 1];
  useEffect(() => {
    if (!userScrolledUp.current) {
      const container = messagesContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [currentConversation.messages.length, isLoading]);

  useEffect(() => {
    if (isStreaming && !userScrolledUp.current) {
      const container = messagesContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [lastMessage?.content, isStreaming]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (attachedFile) {
      const message = inputValue.trim();
      const file = attachedFile;
      setInputValue("");
      setAttachedFile(null);
      if (textareaRef.current) textareaRef.current.style.height = "24px";
      if (fileInputRef.current) fileInputRef.current.value = "";
      await sendMessageWithFile(file, message);
      return;
    }

    if (!inputValue.trim()) return;

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
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    textareaRef.current?.focus();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFile(file);
      textareaRef.current?.focus();
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
      {sidebarOpen ? (
        <>
          <ConversationSidebar
            conversations={conversations}
            currentId={currentConversation.id}
            onNewChat={handleNewChat}
            onSelectConversation={(id: string) => {
              setCurrentConversationId(id);
            }}
            onDeleteConversation={deleteConversation}
            onClearAll={clearAll}
            isOpen={sidebarOpen}
            onToggle={() => setSidebarOpen(false)}
            width={sidebarWidth}
            onLogout={logout}
          />

          <div className="sidebar-resize-handle" onMouseDown={handleMouseDown} />
        </>
      ) : (
        <div className="sidebar-collapsed">
          <button className="sidebar-open-btn" onClick={() => setSidebarOpen(true)} title="Open sidebar">
            <AppLogoIcon />
          </button>
        </div>
      )}

      <div className="chat-main">
        <div className="chat-header">
          <div className="chat-title">
            {currentConversation.title || "New Chat"}
          </div>
          <div className="chat-actions">
            <button className="icon-btn theme-toggle" onClick={toggleTheme} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
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
                    <span className="loading-text">Analyzing</span>
                    <div className="loading-spinner"></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {showScrollBtn && (
          <button
            className="scroll-to-bottom-fab"
            onClick={() => {
              userScrolledUp.current = false;
              setShowScrollBtn(false);
              scrollToBottom();
            }}
            title="Scroll to bottom"
          >
            <ChevronDownIcon />
          </button>
        )}

        <div className="input-area">
          <div className="input-wrapper">
            {attachedFile && (
              <div className="attached-file-preview">
                <div className="file-chip">
                  <span className="file-chip-icon">📎</span>
                  <span className="file-chip-name">{attachedFile.name}</span>
                  <span className="file-chip-size">{formatFileSize(attachedFile.size)}</span>
                  <button
                    className="file-chip-remove"
                    onClick={() => {
                      setAttachedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    title="Remove file"
                  >
                    <CrossIcon width={12} height={12} />
                  </button>
                </div>
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <input
                ref={fileInputRef}
                type="file"
                className="file-input-hidden"
                onChange={handleFileSelect}
                accept=".pdf,.docx,.xlsx,.xls,.csv,.json,.txt,.md,.py,.js,.ts,.java,.html,.css,.xml,.yaml,.yml,.sql,.sh,.bat,.log,.env,.cfg,.ini"
              />
              <div className="input-container">
                <textarea
                  ref={textareaRef}
                  className="message-input"
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={attachedFile ? "Add a message about this file (optional)..." : "Message AI..."}
                  rows={1}
                  disabled={isLoading}
                />
                <div className="input-actions">
                  <button
                    type="button"
                    className="attach-btn"
                    title="Attach file"
                    onClick={() => fileInputRef.current?.click()}
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
                      disabled={(!inputValue.trim() && !attachedFile) || isLoading}
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
