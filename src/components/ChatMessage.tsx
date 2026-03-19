import React from 'react';
import type { ChatMessage as ChatMessageType } from '../types/chat';
import '../styles/chatbot.css';

interface ChatMessageProps {
  message: ChatMessageType;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const formatTime = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatResponseTime = (seconds: number) => {
    if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`;
    return `${seconds.toFixed(2)}s`;
  };

  return (
    <div className={`chat-message-wrapper ${message.role}`}>
      <div className="chat-message">
        <div className={`message-content ${message.role}`}>
          {message.content}
        </div>
        <div className="message-meta">
          {message.role === 'assistant' && message.modelUsed && (
            <span className="model-badge">{message.modelUsed}</span>
          )}
          {message.responseTime && (
            <span className="time-badge">{formatResponseTime(message.responseTime)}</span>
          )}
          <span className="timestamp">{formatTime(message.timestamp)}</span>
        </div>
      </div>
    </div>
  );
};
