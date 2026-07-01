import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
} from "react";
import { ConversationSidebar } from "./ConversationSidebar";
import { ChatMessage } from "./ChatMessage";
import { useChatbot } from "../hooks/useChatbot";
import { useToolExecution } from "../hooks/useToolExecution";
import { ParameterCollector } from "./tools/ParameterCollector";
import { ConfirmationCard } from "./tools/ConfirmationCard";
import { PdfViewerHost } from "./tools/PdfViewerDialog";
import { ExecutionLog } from "./tools/ExecutionLog";
import { navigate } from "./Router";
import SettingsGearIcon from "../assets/settingsGearIcon.svg?react";
import PlusIcon from "../assets/newChatPlusIcon.svg?react";
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
import "../styles/ToolExecution.scss";

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
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

  // Stable ref so useChatbot (called first) can forward tool_call SSE events
  // to triggerFromNL (available only after useToolExecution is called below).
  const onToolCallRef = useRef<
    ((data: import("../types/tools").ToolCallEvent) => void) | undefined
  >(undefined);

  const {
    conversations,
    currentConversation,
    isLoading,
    isStreaming,
    error,
    isAuthenticated,
    user,
    fioriContext,
    sendMessage,
    sendMessageWithFile,
    newConversation,
    deleteConversation,
    clearAll,
    renameConversation,
    togglePinConversation,
    setCurrentConversationId,
    logout,
    stopGenerating,
    editMessage,
    regenerateLastResponse,
    reactToMessage,
    addAssistantMessage,
    execSteps,
  } = useChatbot(
    appId,
    useCallback(
      (data: import("../types/tools").ToolCallEvent) =>
        onToolCallRef.current?.(data),
      [],
    ),
  );

  // ── Tool execution state machine ─────────────────────────────────────────────

  const {
    state: toolState,
    triggerFromNL,
    submitParam,
    goBack: toolGoBack,
    executeConfirmed,
    reset: resetTool,
  } = useToolExecution(
    appId ?? fioriContext?.app_id ?? null,
    addAssistantMessage,
    () => fioriContext?.odata_token ?? undefined,
  );

  // Wire the ref so the useChatbot SSE callback reaches triggerFromNL
  onToolCallRef.current = (data) =>
    triggerFromNL(data.tool_key, data.entity_key, data.parameters ?? {});

  // ── General UI state ─────────────────────────────────────────────────────────

  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(!isInIframe);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [thinkingIdx, setThinkingIdx] = useState(0);

  // Keep a ref to inputValue so async callbacks can read the latest value
  const inputValueRef = useRef(inputValue);
  inputValueRef.current = inputValue;

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
  const inputWrapperRef = useRef<HTMLDivElement>(null);

  const isEmpty = currentConversation.messages.length === 0;

  // ── FLIP animation for the composer ─────────────────────────────────────────

  const flipFromTopRef = useRef<number | null>(null);
  const captureComposerPosition = useCallback(() => {
    const el = inputWrapperRef.current;
    flipFromTopRef.current = el ? el.getBoundingClientRect().top : null;
  }, []);

  useLayoutEffect(() => {
    const el = inputWrapperRef.current;
    const fromTop = flipFromTopRef.current;
    flipFromTopRef.current = null;
    if (!el || fromTop == null) return;
    const dy = fromTop - el.getBoundingClientRect().top;
    if (Math.abs(dy) < 1) return;
    el.style.transition = "none";
    el.style.transform = `translateY(${dy}px)`;
    void el.offsetHeight;
    el.style.transition = "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)";
    el.style.transform = "translateY(0)";
  }, [isEmpty]);

  // ── Sidebar resize ───────────────────────────────────────────────────────────

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

  // ── Theme ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  // ── Iframe controls ──────────────────────────────────────────────────────────

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

  // ── Auth redirect ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isAuthenticated) navigate("/login");
  }, [isAuthenticated]);

  // ── Sidebar outside-click close (mobile) ─────────────────────────────────────

  useEffect(() => {
    if (!sidebarOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (!window.matchMedia("(max-width: 48rem)").matches) return;
      const sidebar = document.querySelector(".sidebar");
      if (sidebar && !sidebar.contains(e.target as Node)) setSidebarOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [sidebarOpen]);

  // ── Scroll management ────────────────────────────────────────────────────────

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
    if (container)
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
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
    if (!isLoading || isStreaming) {
      setThinkingIdx(0);
      return;
    }
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
      if (container) container.scrollTop = container.scrollHeight;
    }
  }, [currentConversation.messages.length, isLoading]);

  useEffect(() => {
    if (isStreaming && !userScrolledUp.current) {
      const container = messagesContainerRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    }
  }, [lastMessage?.content, isStreaming]);

  const handleToolConfirm = useCallback(() => {
    executeConfirmed(fioriContext?.odata_token ?? undefined);
  }, [executeConfirmed, fioriContext]);

  // ── Form submit ──────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Never submit while the tool flow is active
    if (toolState.phase !== "idle") return;
    if (isLoading) return;

    if (isEmpty) captureComposerPosition();

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
    if (textareaRef.current) textareaRef.current.style.height = "24px";
    await sendMessage(message);
  };

  // ── Textarea key handler ─────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // ── Textarea change ──────────────────────────────────────────────────────────

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    if (textareaRef.current) {
      textareaRef.current.style.height = "24px";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  // ── New chat ─────────────────────────────────────────────────────────────────

  const handleNewChat = () => {
    if (!isEmpty) captureComposerPosition();
    newConversation();
    setInputValue("");
    setAttachedFile(null);
    resetTool();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── File attach ──────────────────────────────────────────────────────────────

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

  // ── Derived state ────────────────────────────────────────────────────────────

  const showNormalForm = toolState.phase === "idle";

  // Show inline forms (replaces the textarea)
  const showParamCollector = toolState.phase === "param_collection";
  // Show ConfirmationCard only when the user explicitly confirmed (not for direct execution)
  const showConfirmation =
    (toolState.phase === "confirmation" || toolState.phase === "executing") &&
    !toolState.directExecute;
  // Show a minimal spinner when executing directly (FUNCTION or no-confirmation ACTION)
  const showDirectLoader =
    toolState.phase === "executing" && !!toolState.directExecute;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className={`chatbot-app${isInIframe ? " is-iframe" : ""}${isInIframe && isFullscreen ? " is-fullscreen" : ""}`}
    >
      <PdfViewerHost />
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
        onSelectConversation={(id: string) => setCurrentConversationId(id)}
        onDeleteConversation={deleteConversation}
        onClearAll={clearAll}
        onRenameConversation={renameConversation}
        onTogglePin={togglePinConversation}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((prev) => !prev)}
        width={sidebarOpen ? sidebarWidth : undefined}
        onLogout={logout}
        user={user}
      />

      {sidebarOpen && (
        <div className="sidebar-resize-handle" onMouseDown={handleMouseDown} />
      )}

      <div className={`chat-main${isEmpty ? " is-empty" : ""}`}>
        {/* ── Header ── */}
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

        {/* ── Error banner ── */}
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

        {/* ── Messages ── */}
        <div className="messages-container" ref={messagesContainerRef}>
          {!isEmpty && (
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

              {/* Thinking indicator */}
              {isLoading &&
                !isStreaming &&
                currentConversation.messages.length > 0 &&
                currentConversation.messages[
                  currentConversation.messages.length - 1
                ]?.role === "user" && (
                  <div className="loading-message">
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
                        <path
                          d="M19 1c.3 1.6 1.4 2.7 3 3-1.6.3-2.7 1.4-3 3-.3-1.6-1.4-2.7-3-3 1.6-.3 2.7-1.4 3-3Z"
                          opacity="0.6"
                        />
                      </svg>
                      <span className="loading-thinking-text" key={thinkingIdx}>
                        {THINKING_TEXTS[thinkingIdx]}
                      </span>
                      <span className="loading-bounce-dots">
                        <span />
                        <span />
                        <span />
                      </span>
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>

        {/* ── Scroll-to-bottom FAB ── */}
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

        {/* ── Input area ── */}
        <div className="input-area">
          {isEmpty && (
            <div className="empty-state">
              <div className="empty-state-icon">AI</div>
              <h2>How can I help you today?</h2>
            </div>
          )}

          <div className="input-wrapper" ref={inputWrapperRef}>
            {/* ── Execution animation log (vanishes after result) ── */}
            {execSteps.length > 0 && <ExecutionLog steps={execSteps} />}

            {/* ── Parameter collector (phase: param_collection) ── */}
            {showParamCollector && toolState.selectedTool && (
              <ParameterCollector
                tool={toolState.selectedTool}
                step={toolState.paramStep ?? 0}
                params={toolState.params ?? {}}
                onSubmit={submitParam}
                onBack={toolGoBack}
                onCancel={resetTool}
              />
            )}

            {/* ── Confirmation / executing card (user-confirmed flow) ── */}
            {showConfirmation && toolState.selectedTool && (
              <ConfirmationCard
                tool={toolState.selectedTool}
                params={toolState.params ?? {}}
                isExecuting={toolState.phase === "executing"}
                onConfirm={handleToolConfirm}
                onBack={toolGoBack}
                onCancel={resetTool}
              />
            )}

            {/* ── Direct execution loader (FUNCTION or no-confirmation ACTION) ── */}
            {showDirectLoader && toolState.selectedTool && (
              <div className="direct-exec-card">
                <span className="direct-exec-spinner" aria-hidden="true" />
                <span className="direct-exec-label">
                  Executing{" "}
                  {toolState.selectedTool.display_name ||
                    toolState.selectedTool.name}
                  …
                </span>
              </div>
            )}

            {/* ── Normal chat form (phase: idle | slash_menu) ── */}
            {showNormalForm && (
              <>
                {attachedFile && (
                  <div className="attached-file-preview">
                    <div className="file-chip">
                      <span className="file-chip-icon">📎</span>
                      <span className="file-chip-name">
                        {attachedFile.name}
                      </span>
                      <span className="file-chip-size">
                        {formatFileSize(attachedFile.size)}
                      </span>
                      <button
                        className="file-chip-remove"
                        onClick={() => {
                          setAttachedFile(null);
                          if (fileInputRef.current)
                            fileInputRef.current.value = "";
                        }}
                        title="Remove file"
                        type="button"
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
                          ? "Add a message about this file (optional)…"
                          : "Ask me anything…"
                      }
                      rows={1}
                      disabled={isLoading}
                      aria-label="Chat message input"
                    />
                    <div className="input-actions">
                      <button
                        type="button"
                        className="add-btn"
                        title="Attach file"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading}
                      >
                        <PlusIcon />
                      </button>
                      <div className="input-actions-right">
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
                  </div>
                </form>

                <div className="input-hint">
                  Press Enter to send · Shift + Enter for new line
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
