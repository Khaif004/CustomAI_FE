import React, { useState, useEffect, useRef } from "react";
import type { ChatMessage as ChatMessageType } from "../types/chat";
import copyIcon from "../assets/copyIcon.svg";
import tickIcon from "../assets/tickIcon.svg";
import hljs from "highlight.js";
import "highlight.js/styles/vs2015.css";

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

export const ChatMessage = ({
  message,
  isStreaming = false,
}: ChatMessageProps) => {
  const displayedText = message.content;

  const formatTime = (timestamp: Date) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)}h ago`;

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
      // Code blocks
      if (line.startsWith("```")) {
        flushList();
        flushTable();
        return;
      }

      // Table separator row (|---|---|) - skip it
      if (/^\|[\s\-:|]+\|$/.test(line.trim())) {
        return;
      }

      // Table row
      if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
        flushList();
        const cells = line.trim().slice(1, -1).split("|");
        tableRows.push(cells);
        return;
      }

      // Not a table row - flush any pending table
      flushTable();

      // Horizontal rule
      if (/^---+$/.test(line.trim())) {
        flushList();
        elements.push(<hr key={index} />);
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
        if (!inList || listType !== "ul") {
          flushList();
          inList = true;
          listType = "ul";
        }
        listItems.push(<li key={index}>{formatInline(ulMatch[1])}</li>);
        return;
      }

      // Ordered lists (1. item)
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

      // Regular paragraph
      if (line.trim()) {
        flushList();
        elements.push(<p key={index}>{formatInline(line)}</p>);
        return;
      }

      // Empty line - flush any pending list
      flushList();
    });

    // Flush any remaining list and table
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
      if (codeRef.current) {
        codeRef.current.removeAttribute("data-highlighted");
        hljs.highlightElement(codeRef.current);
      }
    }, [code, lang]);

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
                <img src={tickIcon} alt="Copied" width={14} height={14} />
                Copied
              </>
            ) : (
              <img src={copyIcon} alt="Copy" />
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

  const isCodeBlock = displayedText.includes("```");

  return (
    <div className={`message ${message.role}`}>
      <div className="message-content">
        <div className="message-body">
          {isCodeBlock
            ? displayedText.split("```").map((block: string, index: number) => {
                if (index % 2 === 0) {
                  return <div key={index}>{formatContent(block)}</div>;
                }
                const lines = block.split("\n");
                const language = lines[0]?.trim() || "";
                const code = lines.slice(1).join("\n");
                return (
                  <CodeBlock key={index} language={language} code={code} />
                );
              })
            : formatContent(displayedText)}
        </div>
        <div className="message-actions">
          <button className="message-action-btn" title="Copy" onClick={handleCopyMessage}>
            {copiedMessage ? (
              <>
                <img src={tickIcon} alt="Copied" width={20} height={20} />
                Copied
              </>
            ) : (
              <>
                <img src={copyIcon} alt="Copy" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
