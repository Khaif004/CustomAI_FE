import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from './ChatMessage';
import { ConversationSidebar } from './ConversationSidebar';
import { useChatbot } from '../hooks/useChatbot';
import '../styles/chatbot.css';

export const ChatbotApp: React.FC = () => {
  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    conversations,
    currentConversation,
    isLoading,
    error,
    isAuthenticated,
    authenticate,
    sendMessage,
    newConversation,
    deleteConversation,
    clearAll,
    setCurrentConversationId,
  } = useChatbot();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentConversation.messages]);

  // Auto-authenticate on mount
  useEffect(() => {
    if (!isAuthenticated) {
      setShowAuthPrompt(true);
    }
  }, [isAuthenticated]);

  // Handle auth
  const handleAuthenticate = async () => {
    try {
      await authenticate();
      setShowAuthPrompt(false);
    } catch (err) {
      console.error('Auth error:', err);
    }
  };

  // Handle send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading || !isAuthenticated) return;

    const message = input.trim();
    setInput('');
    setSidebarOpen(false);
    
    await sendMessage(message);
  };

  // Handle paste image (future feature)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let item of items) {
        if (item.type.indexOf('image') !== -1) {
          // Future: handle image upload
          console.log('Image paste detected (future feature)');
        }
      }
    }
  };

  return (
    <div className="chatbot-container">
      {/* Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        currentId={currentConversation.id}
        isOpen={sidebarOpen}
        onSelectConversation={(id) => {
          setCurrentConversationId(id);
          setSidebarOpen(false);
        }}
        onNewConversation={() => {
          newConversation();
          setSidebarOpen(false);
        }}
        onDeleteConversation={deleteConversation}
        onClearAll={clearAll}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Chat Area */}
      <main className="chat-area">
        {/* Auth Prompt */}
        {showAuthPrompt && (
          <div className="auth-prompt">
            <div className="auth-card">
              <h2>Welcome to ChatBot</h2>
              <p>Sign in to start chatting with your AI assistant</p>
              <button className="auth-btn" onClick={handleAuthenticate}>
                Sign In (Developer)
              </button>
              <p className="auth-hint">Using dev token for demonstration</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {currentConversation.messages.length === 0 && isAuthenticated && !showAuthPrompt && (
          <div className="empty-chat">
            <div className="welcome-section">
              <h1>How can I help you today?</h1>
              <p>Chat with your AI-powered assistant</p>

              {/* Quick Prompts */}
              <div className="quick-prompts">
                <button
                  className="prompt-btn"
                  onClick={() => {
                    setInput('Explain the system architecture');
                    document.querySelector('textarea')?.focus();
                  }}
                >
                  <span className="prompt-icon">📋</span>
                  <span>Explain architecture</span>
                </button>
                <button
                  className="prompt-btn"
                  onClick={() => {
                    setInput('What can this system do?');
                    document.querySelector('textarea')?.focus();
                  }}
                >
                  <span className="prompt-icon">✨</span>
                  <span>System capabilities</span>
                </button>
                <button
                  className="prompt-btn"
                  onClick={() => {
                    setInput('Show me cost comparison with Joule');
                    document.querySelector('textarea')?.focus();
                  }}
                >
                  <span className="prompt-icon">💰</span>
                  <span>Cost comparison</span>
                </button>
                <button
                  className="prompt-btn"
                  onClick={() => {
                    setInput('How do I integrate with SAP systems?');
                    document.querySelector('textarea')?.focus();
                  }}
                >
                  <span className="prompt-icon">🔗</span>
                  <span>SAP integration</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        {currentConversation.messages.length > 0 && (
          <div className="messages-container">
            {currentConversation.messages.map(msg => (
              <ChatMessage key={msg.id} message={msg} />
            ))}

            {isLoading && (
              <div className="chat-message-wrapper assistant">
                <div className="chat-message">
                  <div className="message-content assistant loading">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
            <button onClick={() => {}}>Dismiss</button>
          </div>
        )}

        {/* Input Area */}
        <form className="chat-input-form" onSubmit={handleSendMessage}>
          <div className="input-wrapper">
            <textarea
              className="chat-input"
              placeholder="Message ChatBot... (Shift + Enter for new line)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={handlePaste}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e as any);
                }
              }}
              disabled={isLoading || !isAuthenticated}
              rows={1}
            />

            <div className="input-actions">
              <button
                type="button"
                className="action-btn"
                title="Attach file (coming soon)"
                disabled
              >
                📎
              </button>
              <button
                type="submit"
                className="send-btn"
                disabled={!input.trim() || isLoading || !isAuthenticated}
                title={isAuthenticated ? 'Send message' : 'Sign in to send'}
              >
                {isLoading ? <span className="spinner"></span> : '→'}
              </button>
            </div>
          </div>

          <div className="input-footer">
            <small>
              {isAuthenticated ? (
                <>✅ Connected to backend</>
              ) : (
                <>⚠️ Not authenticated</>
              )}
            </small>
          </div>
        </form>
      </main>
    </div>
  );
};
