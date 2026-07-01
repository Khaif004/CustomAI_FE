import React, { useState, useEffect, useRef } from "react";
import type {
  ChatMessage as ChatMessageType,
  GeneratedDocument,
} from "../types/chat";
import CopyIcon from "../assets/copyIcon.svg?react";
import TickIcon from "../assets/tickIcon.svg?react";
import EditIcon from "../assets/editIcon.svg?react";
import MarkdownIcon from "../assets/markdownIcon.svg?react";
import RegenerateIcon from "../assets/regenerateIcon.svg?react";
import ThumbsUpIcon from "../assets/thumbsUpIcon.svg?react";
import ThumbsDownIcon from "../assets/thumbsDownIcon.svg?react";
import hljs from "highlight.js";

const DOC_META: Record<string, { icon: string; label: string; mime: string }> =
  {
    word: {
      icon: "📄",
      label: "Word Document",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
    pdf: { icon: "📕", label: "PDF Document", mime: "application/pdf" },
    excel: {
      icon: "📊",
      label: "Excel Spreadsheet",
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  };

const DOC_GEN_STEPS = [
  "Analysing your request…",
  "Structuring sections…",
  "Writing content…",
  "Formatting document…",
  "Almost ready…",
];

const DocGeneratingCard = ({ docType: _docType }: { docType?: string }) => {
  const [stepIdx, setStepIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Fade out → advance step → fade in, cycling every 1.8 s
    const cycle = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setStepIdx((i) => (i + 1) % DOC_GEN_STEPS.length);
        setVisible(true);
      }, 400);
    }, 1800);
    return () => clearInterval(cycle);
  }, []);

  return (
    <div className="doc-generating-card">
      <div className="doc-gen-icon-wrap">
        <span className="doc-gen-orbit-ring" />
        <span className="doc-gen-icon">✦</span>
      </div>
      <div className="doc-gen-text-wrap">
        <span
          className={`doc-gen-step${visible ? " doc-gen-step--visible" : ""}`}
        >
          {DOC_GEN_STEPS[stepIdx]}
        </span>
        <div className="doc-gen-bar">
          <span className="doc-gen-bar-fill" />
        </div>
      </div>
    </div>
  );
};

const DocDownloadCard = ({ doc }: { doc: GeneratedDocument }) => {
  if (doc.doc_type === "error") {
    return (
      <div className="doc-download-card doc-download-error">
        <div className="doc-download-icon">⚠️</div>
        <div className="doc-download-info">
          <div className="doc-download-title">Document generation failed</div>
          <div className="doc-download-meta">{doc.title}</div>
        </div>
      </div>
    );
  }

  const meta = DOC_META[doc.doc_type] ?? {
    icon: "📎",
    label: "Document",
    mime: "application/octet-stream",
  };

  const handleDownload = () => {
    const bytes = Uint8Array.from(atob(doc.content_base64), (c) =>
      c.charCodeAt(0),
    );
    const blob = new Blob([bytes], { type: meta.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="doc-download-card">
      <div className="doc-download-icon">{meta.icon}</div>
      <div className="doc-download-info">
        <div className="doc-download-title">{doc.title}</div>
        <div className="doc-download-meta">
          {meta.label} · {doc.filename}
        </div>
      </div>
      <button
        className="doc-download-btn"
        onClick={handleDownload}
        title="Download"
      >
        ⬇ Download
      </button>
    </div>
  );
};

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
  isLastAssistant?: boolean;
  onEdit?: (messageId: string, newContent: string) => void;
  onRegenerate?: () => void;
  onReact?: (
    messageId: string,
    reaction: "thumbs-up" | "thumbs-down" | null,
  ) => void;
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

    const labelFromUrl = (url: string): string => {
      try {
        const { hostname, pathname } = new URL(url);
        const host = hostname.replace(/^www\./, "");
        const slug = pathname
          .replace(/\/$/, "")
          .split("/")
          .filter(Boolean)
          .pop();
        if (!slug) return host;
        const readable = slug
          .replace(/[_-]/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        return `${readable} – ${host}`;
      } catch {
        return url;
      }
    };

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      const codeMatch = remaining.match(/`([^`]+)`/);
      const mdLinkMatch = remaining.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
      const bareUrlMatch = remaining.match(/(?<!\]\()https?:\/\/[^\s)>\]"]+/);

      const matches = [
        boldMatch
          ? { type: "bold", match: boldMatch, index: boldMatch.index! }
          : null,
        codeMatch
          ? { type: "code", match: codeMatch, index: codeMatch.index! }
          : null,
        mdLinkMatch
          ? { type: "mdlink", match: mdLinkMatch, index: mdLinkMatch.index! }
          : null,
        bareUrlMatch
          ? { type: "bareurl", match: bareUrlMatch, index: bareUrlMatch.index! }
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
      } else if (first.type === "mdlink") {
        const label = first.match![1];
        const url = first.match![2];
        const displayLabel = label === url ? labelFromUrl(url) : label;
        parts.push(
          <a
            key={`l${keyIdx++}`}
            href={url}
            title={url}
            target="_blank"
            rel="noopener noreferrer"
            className="chat-link"
          >
            {displayLabel}
          </a>,
        );
      } else if (first.type === "bareurl") {
        const url = first.match![0];
        parts.push(
          <a
            key={`u${keyIdx++}`}
            href={url}
            title={url}
            target="_blank"
            rel="noopener noreferrer"
            className="chat-link"
          >
            {labelFromUrl(url)}
          </a>,
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
          <div
            key={`table-wrap-${tableKey}`}
            className={`table-wrapper${isStreaming ? " table-streaming" : ""}`}
          >
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

      const trimmedLine = line.trim();

      // Separator row — trailing | is optional so partial forms mid-stream
      // (e.g. "| --- | ---") are silently absorbed rather than rendered.
      if (/^\|[\s\-:|]+\|?$/.test(trimmedLine)) {
        return;
      }

      // Complete table row
      if (trimmedLine.startsWith("|") && trimmedLine.endsWith("|")) {
        flushList();
        const cells = trimmedLine.slice(1, -1).split("|");
        tableRows.push(cells);
        return;
      }

      // During streaming the closing | of the last row hasn't arrived yet.
      // Absorb partial rows into the table block so raw "|…" text never
      // appears as a paragraph in the chat bubble.
      if (isStreaming && trimmedLine.startsWith("|")) {
        flushList();
        const cells = trimmedLine.slice(1).split("|");
        tableRows.push(cells);
        return;
      }

      flushTable();

      if (/^---+$/.test(line.trim())) {
        flushList();
        elements.push(<hr key={index} />);
        return;
      }

      if (line.startsWith("#### ")) {
        flushList();
        elements.push(<h5 key={index}>{formatInline(line.slice(5))}</h5>);
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
          <code
            ref={codeRef}
            className={lang !== "code" ? `language-${lang}` : ""}
          >
            {code}
          </code>
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
                <span className="attachment-name">
                  {message.attachment.name}
                </span>
              </div>
            )}
            <div
              className={`message-body${isStreaming && message.role === "assistant" ? " is-streaming" : ""}`}
            >
              {message.role === "assistant" && showRaw ? (
                <pre className="raw-markdown">{displayedText}</pre>
              ) : isCodeBlock ? (
                displayedText
                  .split("```")
                  .map((block: string, index: number) => {
                    if (index % 2 === 0) {
                      return <div key={index}>{formatContent(block)}</div>;
                    }
                    const lines = block.split("\n");
                    const language = lines[0]?.trim() || "";
                    const code = lines.slice(1).join("\n").replace(/\n+$/, "");
                    return (
                      <CodeBlock key={index} language={language} code={code} />
                    );
                  })
              ) : (
                formatContent(displayedText)
              )}
            </div>
            {message.isGeneratingDoc &&
              !message.generatedDocument &&
              !message.errorMessage && (
                <DocGeneratingCard docType={message.content} />
              )}
            {message.generatedDocument && !isStreaming && (
              <DocDownloadCard doc={message.generatedDocument} />
            )}
            {message.errorMessage && (
              <div className="message-error-block">
                <div className="message-error-header">
                  <span className="message-error-icon">⚠</span>
                  <span className="message-error-title">
                    Something went wrong
                  </span>
                </div>
                <p className="message-error-body">{message.errorMessage}</p>
                {onRegenerate && isLastAssistant && (
                  <button
                    className="message-error-retry"
                    onClick={onRegenerate}
                  >
                    ↺ Try again
                  </button>
                )}
              </div>
            )}
            {!isStreaming && (
              <div className="message-actions">
                <button
                  className="message-action-btn"
                  title="Copy"
                  onClick={handleCopyMessage}
                >
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
                  <button
                    className="message-action-btn"
                    title="Edit message"
                    onClick={handleStartEdit}
                  >
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
                {message.role === "assistant" &&
                  isLastAssistant &&
                  onRegenerate &&
                  !isStreaming && (
                    <button
                      className="message-action-btn"
                      title="Regenerate response"
                      onClick={onRegenerate}
                    >
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
