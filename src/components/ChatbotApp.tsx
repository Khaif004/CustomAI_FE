import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ConversationSidebar } from "./ConversationSidebar";
import { ChatMessage } from "./ChatMessage";
import { useChatbot } from "../hooks/useChatbot";
import { navigate } from "./Router";
import SettingsGearIcon from "../assets/settingsGearIcon.svg?react";
import AttachIcon from "../assets/attachIcon.svg?react";
import SendIcon from "../assets/sendIcon.svg?react";
import StopIcon from "../assets/stopIcon.svg?react";
import CrossIcon from "../assets/crossIcon.svg?react";
import SunIcon from "../assets/sunIcon.svg?react";
import MoonIcon from "../assets/moonIcon.svg?react";
import ChevronDownIcon from "../assets/chevronDownIcon.svg?react";
import HamburgerMenuIcon from "../assets/hamburgerMenuIcon.svg?react";
import FullscreenIcon from "../assets/fullscreenIcon.svg?react";
import ExitFullscreenIcon from "../assets/exitFullscreenIcon.svg?react";
import MinimizeIcon from "../assets/minimizeIcon.svg?react";
import "../styles/ChatbotApp.scss";
import "../styles/ChatMessage.scss";
import "../styles/ConversationSidebar.scss";

const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();

const THINKING_TEXTS = [
  "Thinking...",
  "Analyzing your question...",
  "Processing...",
  "Looking into this...",
  "Crafting a response...",
  "Putting it together...",
];

export const ChatbotApp = () => {
  const appId = new URLSearchParams(window.location.search).get("appId");

  const {
    conversations,
    currentConversation,
    isLoading,
    isStreaming,
    error,
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
    fioriContext,
  } = useChatbot(appId);

  const [dismissedError, setDismissedError] = useState<string | null>(null);

  const [inputValue, setInputValue] = useState("");
  // Sidebar starts closed inside an iframe — the panel is too narrow to share.
  const [sidebarOpen, setSidebarOpen] = useState(!isInIframe);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [thinkingIdx, setThinkingIdx] = useState(0);

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
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

  const handleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
    window.parent.postMessage({ type: "btp-copilot:fullscreen" }, "*");
  }, []);

  const handleMinimize = useCallback(() => {
    window.parent.postMessage({ type: "btp-copilot:minimize" }, "*");
  }, []);

  const handleClose = useCallback(() => {
    window.parent.postMessage({ type: "btp-copilot:close" }, "*");
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated]);

  // Close the sidebar when the user clicks / taps anywhere outside of it.
  // Only active on tablet / mobile (≤ 768 px) where the sidebar overlays the chat.
  // On larger screens the sidebar sits inline, so outside-clicks should be ignored.
  useEffect(() => {
    if (!sidebarOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (!window.matchMedia("(max-width: 48rem)").matches) return;
      const sidebar = document.querySelector(".sidebar");
      if (sidebar && !sidebar.contains(e.target as Node)) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [sidebarOpen]);

  const isNearBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    return (
      container.scrollHeight - container.scrollTop - container.clientHeight <
      100
    );
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

  useEffect(() => {
    if (!isLoading || isStreaming) { setThinkingIdx(0); return; }
    const id = setInterval(
      () => setThinkingIdx((i) => (i + 1) % THINKING_TEXTS.length),
      1500,
    );
    return () => clearInterval(id);
  }, [isLoading, isStreaming]);

  const lastMessage =
    currentConversation.messages[currentConversation.messages.length - 1];
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

  const suggestions = useMemo(() => {
    const ctx = fioriContext;
    const appName = ctx?.app_name || ctx?.app_id || appId;
    const schemaHint = ctx?.extra?.schema_hint as string | undefined;
    const entityData = ctx?.entity_data as Record<string, unknown> | undefined;
    const currentView = ctx?.current_view as string | undefined;

    // No meaningful context yet — generic fallback
    if (!appName && !schemaHint && !currentView) {
      return [
        { title: "Explain a concept", text: "How does machine learning work?" },
        { title: "Write code", text: "Create a React component for a button" },
      ];
    }

    const name = appName || "this application";

    // Extract entity names from schema hint (## EntityName headings)
    const entityNames: string[] =
      schemaHint
        ?.match(/^##\s+(.+)$/gm)
        ?.map((m: string) => m.replace(/^##\s+/, "").trim())
        .filter(Boolean) ?? [];

    const items: { title: string; text: string }[] = [];

    // 1. App overview
    items.push({
      title: `${name} overview`,
      text: `What can you help me with in the ${name} application?`,
    });

    // 2. Current record or current screen
    if (entityData && Object.keys(entityData).length > 0) {
      const [key, val] = Object.entries(entityData)[0];
      items.push({
        title: "Current record",
        text: `Tell me about this ${key}: ${String(val)}`,
      });
    } else if (currentView && currentView.length > 1) {
      items.push({
        title: "Current screen",
        text: `What data and actions are available on the current screen?`,
      });
    }

    // 3 & 4. Entity-specific questions from schema
    if (entityNames[0]) {
      items.push({
        title: entityNames[0],
        text: `Explain the ${entityNames[0]} and its key fields`,
      });
    }

    if (entityNames[1]) {
      items.push({
        title: entityNames[1],
        text: `How does ${entityNames[1]} relate to ${entityNames[0] ?? name}?`,
      });
    } else {
      items.push({
        title: "Workflow",
        text: `Walk me through a typical ${name} workflow step by step`,
      });
    }

    return items.slice(0, 4);
  }, [fioriContext, appId]);

  return (
    <div className={`chatbot-app${isInIframe ? " is-iframe" : ""}${isInIframe && isFullscreen ? " is-fullscreen" : ""}`}>
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}
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
        onToggle={() => setSidebarOpen((prev) => !prev)}
        width={sidebarOpen ? sidebarWidth : undefined}
        onLogout={logout}
      />

      {sidebarOpen && (
        <div
          className="sidebar-resize-handle"
          onMouseDown={handleMouseDown}
        />
      )}

      <div className="chat-main">
        <div className="chat-header">
          <button
            className="chat-header-menu-btn"
            onClick={() => setSidebarOpen((prev) => !prev)}
            title="Open sidebar"
          >
            <HamburgerMenuIcon />
          </button>
          <div className="chat-title">
            {currentConversation.title || "New Chat"}
          </div>
          <div className="chat-actions">
            <button
              className="icon-btn theme-toggle"
              onClick={toggleTheme}
              title={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
            <button className="icon-btn" title="Settings">
              <SettingsGearIcon />
            </button>
            {isInIframe && (
              <div className="iframe-controls">
                <button
                  className="iframe-ctrl-btn fullscreen-btn"
                  onClick={handleFullscreen}
                  title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
                </button>
                <button
                  className="iframe-ctrl-btn minimize-btn"
                  onClick={handleMinimize}
                  title="Minimize"
                >
                  <MinimizeIcon />
                </button>
                <button
                  className="iframe-ctrl-btn close-btn"
                  onClick={handleClose}
                  title="Close"
                >
                  <CrossIcon />
                </button>
              </div>
            )}
          </div>
        </div>

        {error && error !== dismissedError && (
          <div className="app-error-banner" role="alert">
            <span className="app-error-icon">⚠</span>
            <span className="app-error-text">{error}</span>
            <button
              className="app-error-dismiss"
              onClick={() => setDismissedError(error)}
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

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
              {currentConversation.messages.map(
                (message: any, index: number) => {
                  const isLastMessage =
                    index === currentConversation.messages.length - 1;
                  const isMessageStreaming =
                    isLastMessage &&
                    isStreaming &&
                    message.role === "assistant";
                  const lastAssistantIdx =
                    currentConversation.messages.findLastIndex(
                      (m: any) => m.role === "assistant",
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
                },
              )}
              {isLoading &&
                !isStreaming &&
                currentConversation.messages.length > 0 &&
                currentConversation.messages[
                  currentConversation.messages.length - 1
                ]?.role === "user" && (
                  <div className="loading-message">
                    <div className="loading-avatar">AI</div>
                    <div className="loading-bubble">
                      <svg
                        className="loading-spark-icon"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        width="15"
                        height="15"
                        aria-hidden="true"
                      >
                        <path d="M12 2c.4 3.6 3.4 6.5 7 7-3.6.5-6.6 3.4-7 7-.4-3.6-3.4-6.5-7-7 3.6-.5 6.6-3.4 7-7Z" />
                        <path d="M19 1c.3 1.6 1.4 2.7 3 3-1.6.3-2.7 1.4-3 3-.3-1.6-1.4-2.7-3-3 1.6-.3 2.7-1.4 3-3Z" opacity="0.6" />
                      </svg>
                      <span
                        className="loading-thinking-text"
                        key={thinkingIdx}
                      >
                        {THINKING_TEXTS[thinkingIdx]}
                      </span>
                      <span className="loading-bounce-dots">
                        <span /><span /><span />
                      </span>
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
                  <span className="file-chip-size">
                    {formatFileSize(attachedFile.size)}
                  </span>
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
                  placeholder={
                    attachedFile
                      ? "Add a message about this file (optional)..."
                      : "Ask anything"
                  }
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
                      disabled={
                        (!inputValue.trim() && !attachedFile) || isLoading
                      }
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
