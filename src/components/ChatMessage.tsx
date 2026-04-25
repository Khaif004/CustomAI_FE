import React, { useState, useEffect, useRef } from "react";
import type { ChatMessage as ChatMessageType } from "../types/chat";
import CopyIcon from "../assets/copyIcon.svg?react";
import TickIcon from "../assets/tickIcon.svg?react";
import EditIcon from "../assets/editIcon.svg?react";
import MarkdownIcon from "../assets/markdownIcon.svg?react";
import RegenerateIcon from "../assets/regenerateIcon.svg?react";
import ThumbsUpIcon from "../assets/thumbsUpIcon.svg?react";
import ThumbsDownIcon from "../assets/thumbsDownIcon.svg?react";
import hljs from "highlight.js";

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
  isLastAssistant?: boolean;
  onEdit?: (messageId: string, newContent: string) => void;
  onRegenerate?: () => void;
  onReact?: (messageId: string, reaction: "thumbs-up" | "thumbs-down" | null) => void;
}

export const ChatMessage = ({
  message,
  isStreaming = false,
  isLastAssistant = false,
  onEdit,
  onRegenerate,
  onReact,
}: ChatMessageProps) => {
  const displayedText = message.content;
  const [showRaw, setShowRaw] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const formatInline = (text: string): (string | React.JSX.Element)[] => {
    const parts: (string | React.JSX.Element)[] = [];
    let remaining = text;
    let keyIdx = 0;

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      const codeMatch = remaining.match(/`([^`]+)`/);

      const matches = [
        boldMatch
          ? { type: "bold", match: boldMatch, index: boldMatch.index! }
          : null,
        codeMatch
          ? { type: "code", match: codeMatch, index: codeMatch.index! }
          : null,
      ]
        .filter(Boolean)
        .sort((a, b) => a!.index - b!.index);

      if (matches.length === 0) {
        parts.push(remaining);
        break;
      }

      const first = matches[0]!;
      if (first.index > 0) {
        parts.push(remaining.substring(0, first.index));
      }

      if (first.type === "bold") {
        parts.push(<strong key={`b${keyIdx++}`}>{first.match![1]}</strong>);
      } else if (first.type === "code") {
        parts.push(
          <code key={`c${keyIdx++}`} className="inline-code">
            {first.match![1]}
          </code>,
        );
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
    let listType: "ul" | "ol" = "ul";
    let listKey = 0;

    const flushList = () => {
      if (listItems.length > 0) {
        if (listType === "ol") {
          elements.push(<ol key={`list-${listKey++}`}>{listItems}</ol>);
        } else {
          elements.push(<ul key={`list-${listKey++}`}>{listItems}</ul>);
        }
        listItems = [];
        inList = false;
      }
    };

    let tableRows: string[][] = [];
    let tableKey = 0;

    const flushTable = () => {
      if (tableRows.length > 0) {
        const headerRow = tableRows[0];
        const bodyRows = tableRows.slice(1);
        elements.push(
          <div key={`table-wrap-${tableKey}`} className="table-wrapper">
            <table key={`table-${tableKey++}`}>
              <thead>
                <tr>
                  {headerRow.map((cell, ci) => (
                    <th key={ci}>{formatInline(cell.trim())}</th>
                  ))}
                </tr>
              </thead>
              {bodyRows.length > 0 && (
                <tbody>
                  {bodyRows.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td key={ci}>{formatInline(cell.trim())}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>,
        );
        tableRows = [];
      }
    };

    lines.forEach((line, index) => {
      if (line.startsWith("```")) {
        flushList();
        flushTable();
        return;
      }

      if (/^\|[\s\-:|]+\|$/.test(line.trim())) {
        return;
      }

      if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
        flushList();
        const cells = line.trim().slice(1, -1).split("|");
        tableRows.push(cells);
        return;
      }

      flushTable();

      if (/^---+$/.test(line.trim())) {
        flushList();
        elements.push(<hr key={index} />);
        return;
      }

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

      const ulMatch = line.match(/^[\*\-]\s+(.*)/);
      if (ulMatch) {
        if (!inList || listType !== "ul") {
          flushList();
          inList = true;
          listType = "ul";
        }
        listItems.push(<li key={index}>{formatInline(ulMatch[1])}</li>);
        return;
      }

      const olMatch = line.match(/^\d+\.\s+(.*)/);
      if (olMatch) {
        if (!inList || listType !== "ol") {
          flushList();
          inList = true;
          listType = "ol";
        }
        listItems.push(<li key={index}>{formatInline(olMatch[1])}</li>);
        return;
      }

      if (line.trim()) {
        flushList();
        elements.push(<p key={index}>{formatInline(line)}</p>);
        return;
      }

      flushList();
    });

    flushList();
    flushTable();

    return elements;
  };

  const CodeBlock = ({
    language,
    code,
  }: {
    language: string;
    code: string;
  }) => {
    const [copied, setCopied] = useState(false);
    const codeRef = useRef<HTMLElement>(null);
    const lang = language.toLowerCase() || "code";

    useEffect(() => {
      if (isStreaming) return;
      if (codeRef.current) {
        codeRef.current.removeAttribute("data-highlighted");
        hljs.highlightElement(codeRef.current);
      }
    }, [code, lang, isStreaming]);

    const handleCopy = async () => {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className="code-block">
        <div className="code-block-header">
          <span className="code-lang-label">
            <span className="code-lang-icon">&lt;/&gt;</span>
            {lang}
          </span>
          <button
            className="code-copy-btn"
            onClick={handleCopy}
            title="Copy code"
          >
            {copied ? (
              <>
                <TickIcon width={14} height={14} />
                Copied
              </>
            ) : (
              <CopyIcon width={14} height={14} />
            )}
          </button>
        </div>
        <pre>
          <code ref={codeRef} className={lang !== "code" ? `language-${lang}` : ""}>{code}</code>
        </pre>
      </div>
    );
  };

  const [copiedMessage, setCopiedMessage] = useState(false);

  const handleCopyMessage = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  const handleStartEdit = () => {
    setEditContent(message.content);
    setIsEditing(true);
    setTimeout(() => editRef.current?.focus(), 0);
  };

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== message.content && onEdit) {
      onEdit(message.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    }
    if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  const isCodeBlock = displayedText.includes("```");

  return (
    <div className={`message ${message.role}`}>
      <div className="message-content">
        {message.role === "user" && isEditing ? (
          <div className="edit-mode">
            <textarea
              ref={editRef}
              className="edit-textarea"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleEditKeyDown}
              rows={3}
            />
            <div className="edit-actions">
              <button className="edit-save-btn" onClick={handleSaveEdit}>
                Save & Submit
              </button>
              <button className="edit-cancel-btn" onClick={handleCancelEdit}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {message.attachment && (
              <div className="message-attachment">
                <span className="attachment-icon">📎</span>
                <span className="attachment-name">{message.attachment.name}</span>
              </div>
            )}
            <div className="message-body">
              {message.role === "assistant" && showRaw ? (
                <pre className="raw-markdown">{displayedText}</pre>
              ) : isCodeBlock ? (
                displayedText.split("```").map((block: string, index: number) => {
                  if (index % 2 === 0) {
                    return <div key={index}>{formatContent(block)}</div>;
                  }
                  const lines = block.split("\n");
                  const language = lines[0]?.trim() || "";
                  const code = lines.slice(1).join("\n").replace(/\n+$/, '');
                  return (
                    <CodeBlock key={index} language={language} code={code} />
                  );
                })
              ) : (
                formatContent(displayedText)
              )}
            </div>
            {!isStreaming && (
            <div className="message-actions">
              <button className="message-action-btn" title="Copy" onClick={handleCopyMessage}>
                {copiedMessage ? (
                  <>
                    <TickIcon width={14} height={14} />
                    Copied
                  </>
                ) : (
                  <CopyIcon width={14} height={14} />
                )}
              </button>

              {message.role === "user" && onEdit && (
                <button className="message-action-btn" title="Edit message" onClick={handleStartEdit}>
                  <EditIcon width={14} height={14} />
                </button>
              )}

              {/* Markdown toggle - assistant messages only */}
              {message.role === "assistant" && (
                <button
                  className={`message-action-btn ${showRaw ? "active" : ""}`}
                  title={showRaw ? "Show rendered" : "Show raw markdown"}
                  onClick={() => setShowRaw(!showRaw)}
                >
                  <MarkdownIcon width={14} height={14} />
                </button>
              )}

              {/* Regenerate - last assistant message only */}
              {message.role === "assistant" && isLastAssistant && onRegenerate && !isStreaming && (
                <button className="message-action-btn" title="Regenerate response" onClick={onRegenerate}>
                  <RegenerateIcon width={14} height={14} />
                </button>
              )}

              {/* Reactions - assistant messages only */}
              {message.role === "assistant" && onReact && (
                <div className="reaction-buttons">
                  <button
                    className={`message-action-btn ${message.reaction === "thumbs-up" ? "reaction-active" : ""}`}
                    title="Good response"
                    onClick={() => onReact(message.id, "thumbs-up")}
                  >
                    <ThumbsUpIcon width={14} height={14} />
                  </button>
                  <button
                    className={`message-action-btn ${message.reaction === "thumbs-down" ? "reaction-active" : ""}`}
                    title="Bad response"
                    onClick={() => onReact(message.id, "thumbs-down")}
                  >
                    <ThumbsDownIcon width={14} height={14} />
                  </button>
                </div>
              )}
            </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
