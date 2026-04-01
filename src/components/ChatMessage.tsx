import React, { useState, useEffect } from 'react';
import type { ChatMessage as ChatMessageType } from "../types/chat";

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

export const ChatMessage = ({ message, isStreaming = false }: ChatMessageProps) => {
  const [displayedText, setDisplayedText] = useState(() => isStreaming ? "" : message.content);

  useEffect(() => {
    if (!isStreaming) {
      setDisplayedText(message.content);
      return;
    }

    // Start from current displayed text or 0
    let index = displayedText.length;
    
    // Only start interval if we haven't reached the end
    if (index >= message.content.length) {
      return;
    }

    const interval = setInterval(() => {
      index++;
      setDisplayedText(message.content.substring(0, index));
      if (index >= message.content.length) {
        clearInterval(interval);
      }
    }, 15); // Speed of reveal

    return () => clearInterval(interval);
  }, [message.content, isStreaming, displayedText]);

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

  const formatInline = (text: string): (string | React.JSX.Element)[] => {
    const parts: (string | React.JSX.Element)[] = [];
    let remaining = text;
    let keyIdx = 0;

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      const codeMatch = remaining.match(/`([^`]+)`/);

      const matches = [
        boldMatch ? { type: 'bold', match: boldMatch, index: boldMatch.index! } : null,
        codeMatch ? { type: 'code', match: codeMatch, index: codeMatch.index! } : null,
      ].filter(Boolean).sort((a, b) => a!.index - b!.index);

      if (matches.length === 0) {
        parts.push(remaining);
        break;
      }

      const first = matches[0]!;
      if (first.index > 0) {
        parts.push(remaining.substring(0, first.index));
      }

      if (first.type === 'bold') {
        parts.push(<strong key={`b${keyIdx++}`}>{first.match![1]}</strong>);
      } else if (first.type === 'code') {
        parts.push(<code key={`c${keyIdx++}`} className="inline-code">{first.match![1]}</code>);
      }

      remaining = remaining.substring(first.index + first.match![0].length);
    }

    return parts;
  };

  const formatContent = (content: string) => {
    const lines = content.split("\n");
    const elements: React.JSX.Element[] = [];
    let inList = false;
    let listItems: React.JSX.Element[] = [];
    let listType: 'ul' | 'ol' = 'ul';
    let listKey = 0;

    const flushList = () => {
      if (listItems.length > 0) {
        if (listType === 'ol') {
          elements.push(<ol key={`list-${listKey++}`}>{listItems}</ol>);
        } else {
          elements.push(<ul key={`list-${listKey++}`}>{listItems}</ul>);
        }
        listItems = [];
        inList = false;
      }
    };

    lines.forEach((line, index) => {
      // Code blocks
      if (line.startsWith("```")) {
        flushList();
        return;
      }

      // Headers
      if (line.startsWith("### ")) {
        flushList();
        elements.push(<h5 key={index}>{formatInline(line.slice(4))}</h5>);
        return;
      }
      if (line.startsWith("## ")) {
        flushList();
        elements.push(<h4 key={index}>{formatInline(line.slice(3))}</h4>);
        return;
      }
      if (line.startsWith("# ")) {
        flushList();
        elements.push(<h3 key={index}>{formatInline(line.slice(2))}</h3>);
        return;
      }

      // Unordered lists (- item or * item)
      const ulMatch = line.match(/^[\*\-]\s+(.*)/);
      if (ulMatch) {
        if (!inList || listType !== 'ul') {
          flushList();
          inList = true;
          listType = 'ul';
        }
        listItems.push(<li key={index}>{formatInline(ulMatch[1])}</li>);
        return;
      }

      // Ordered lists (1. item)
      const olMatch = line.match(/^\d+\.\s+(.*)/);
      if (olMatch) {
        if (!inList || listType !== 'ol') {
          flushList();
          inList = true;
          listType = 'ol';
        }
        listItems.push(<li key={index}>{formatInline(olMatch[1])}</li>);
        return;
      }

      // Regular paragraph
      if (line.trim()) {
        flushList();
        elements.push(<p key={index}>{formatInline(line)}</p>);
        return;
      }

      // Empty line - flush any pending list
      flushList();
    });

    // Flush any remaining list
    flushList();

    return elements;
  };

  const isCodeBlock = displayedText.includes("```");
  
  return (
    <div className={`message ${message.role}`}>
      <div className="message-content">
        <div className="message-body">
          {isCodeBlock ? (
            // Handle code blocks
            displayedText.split("```").map((block: string, index: number) => {
              if (index % 2 === 0) {
                return <div key={index}>{formatContent(block)}</div>;
              }
              const lines = block.split("\n");
              const code = lines.slice(1).join("\n");
              return (
                <pre key={index}>
                  <code>{code}</code>
                </pre>
              );
            })
          ) : (
            formatContent(displayedText)
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