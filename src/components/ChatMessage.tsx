import type { ChatMessage as ChatMessageType } from "../types/chat";

interface ChatMessageProps {
  message: ChatMessageType;
}

export const ChatMessage = ({ message }: ChatMessageProps) => {
  const formatTime = (timestamp: Date) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatContent = (content: string) => {
    // Simple markdown-like formatting
    const lines = content.split("\n");
    const formatted = lines.map((line, index) => {
      // Code blocks
      if (line.startsWith("```")) {
        return null; // Handle in separate pass
      }
      
      // Headers
      if (line.startsWith("# ")) {
        return <h3 key={index}>{line.slice(2)}</h3>;
      }
      if (line.startsWith("## ")) {
        return <h4 key={index}>{line.slice(3)}</h4>;
      }
      
      // Lists
      if (line.match(/^[\*\-]\s/)) {
        return <li key={index}>{line.slice(2)}</li>;
      }
      if (line.match(/^\d+\.\s/)) {
        return <li key={index}>{line.replace(/^\d+\.\s/, "")}</li>;
      }
      
      // Regular paragraph
      if (line.trim()) {
        return <p key={index}>{line}</p>;
      }
      
      return null;
    }).filter(Boolean);

    return formatted;
  };

  const isCodeBlock = message.content.includes("```");
  
  return (
    <div className={`message ${message.role}`}>
      <div className="message-content">
        <div className="message-body">
          {isCodeBlock ? (
            // Handle code blocks
            message.content.split("```").map((block: string, index: number) => {
              if (index % 2 === 0) {
                return <p key={index}>{block}</p>;
              }
              const lines = block.split("\n");
              const language = lines[0].trim();
              const code = lines.slice(1).join("\n");
              return (
                <pre key={index}>
                  <code>{code}</code>
                </pre>
              );
            })
          ) : (
            formatContent(message.content)
          )}
        </div>
        {message.role === "assistant" && (
          <div className="message-actions">
            <button className="message-action-btn" title="Copy">
              <svg viewBox="0 0 24 24">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              Copy
            </button>
            <button className="message-action-btn" title="Regenerate">
              <svg viewBox="0 0 24 24">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2" />
              </svg>
              Regenerate
            </button>
          </div>
        )}
      </div>
    </div>
  );
};