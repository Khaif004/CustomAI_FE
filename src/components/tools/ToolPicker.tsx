import { useEffect, useRef, type FC } from "react";
import type { ToolDefinition } from "../../types/tools";
import BackArrowIcon from "../../assets/backArrowIcon.svg?react";
import CloseIcon from "../../assets/closeIcon.svg?react";

interface Props {
  tools: ToolDefinition[];
  toolType: "ACTION" | "FUNCTION";
  isLoading: boolean;
  error?: string;
  query: string;
  selectedIdx: number;
  onSelect: (tool: ToolDefinition) => void;
  onHover: (idx: number) => void;
  onBack: () => void;
  onClose: () => void;
}

// SAP CAP draft-framework internals — not useful for end users
const SYSTEM_TOOL_NAMES = new Set([
  "draftActivate",
  "draftEdit",
  "draftPrepare",
]);

// camelCase / PascalCase → "Title Case With Spaces"
function formatName(raw: string): string {
  return raw
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/^[a-z]/, (c) => c.toUpperCase());
}

// Verb-form map for building a readable sentence from the action name
const VERB_MAP: Record<string, string> = {
  Create: "Creates",
  Add: "Adds",
  Insert: "Inserts",
  Update: "Updates",
  Edit: "Edits",
  Set: "Sets",
  Modify: "Modifies",
  Delete: "Deletes",
  Remove: "Removes",
  Get: "Retrieves",
  Fetch: "Fetches",
  Load: "Loads",
  Release: "Releases",
  Cancel: "Cancels",
  Close: "Closes",
  Calculate: "Calculates",
  Compute: "Computes",
  Refresh: "Refreshes",
  Reload: "Reloads",
  Sync: "Syncs",
  Render: "Renders",
  Print: "Prints",
  Generate: "Generates",
  Apply: "Applies",
  Process: "Processes",
  Execute: "Executes",
  Copy: "Copies",
  Clone: "Clones",
  Save: "Saves",
  Upload: "Uploads",
  Import: "Imports",
  Export: "Exports",
  Assign: "Assigns",
  Allocate: "Allocates",
  Recalculate: "Recalculates",
  Un: "Reverses",
  On: "Handles",
};

/** Auto-generate a human-readable description from the tool name + metadata. */
function generateDesc(tool: ToolDefinition): string {
  const words = formatName(tool.display_name || tool.name).split(" ");
  const [first, ...rest] = words;
  const verb = VERB_MAP[first];
  if (verb && rest.length > 0) {
    return `${verb} ${rest.map((w) => w.toLowerCase()).join(" ")}`;
  }
  // Fallback — entity · method
  const context =
    tool.entity_name ?? tool.service_name?.replace(/Service$/, "");
  return [context, tool.http_method].filter(Boolean).join(" · ");
}

export const ToolPicker: FC<Props> = ({
  tools,
  toolType,
  isLoading,
  error,
  query,
  selectedIdx,
  onSelect,
  onHover,
  onBack,
  onClose,
}) => {
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = tools.filter((t) => {
    if (SYSTEM_TOOL_NAMES.has(t.name)) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      formatName(t.display_name || t.name).toLowerCase().includes(q) ||
      (t.display_name || t.name).toLowerCase().includes(q) ||
      (t.entity_name ?? "").toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    const item = listRef.current?.querySelectorAll<HTMLButtonElement>(
      ".slash-popup-item",
    )[selectedIdx];
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  const typeLabel = toolType === "ACTION" ? "Actions" : "Functions";

  return (
    <div
      className="slash-popup"
      role="listbox"
      aria-label={`${typeLabel} list`}
    >
      <div className="slash-popup-header slash-popup-header--nav">
        <button
          className="slash-popup-nav-btn"
          onClick={onBack}
          type="button"
          aria-label="Back to commands"
          title="Back"
        >
          <BackArrowIcon width={14} height={14} />
        </button>
        <span className="slash-popup-breadcrumb">
          <span className="slash-popup-breadcrumb-parent">Commands</span>
          <span className="slash-popup-breadcrumb-sep"> / </span>
          <span className="slash-popup-breadcrumb-current">{typeLabel}</span>
        </span>
        <button
          className="slash-popup-nav-btn slash-popup-nav-btn--close"
          onClick={onClose}
          type="button"
          aria-label="Close"
          title="Close"
        >
          <CloseIcon width={12} height={12} />
        </button>
      </div>

      <div ref={listRef} className="slash-popup-list">
        {isLoading && (
          <div className="slash-popup-state">
            <span className="slash-popup-spinner" aria-hidden="true" />
            Loading {typeLabel.toLowerCase()}…
          </div>
        )}

        {!isLoading && error && (
          <div className="slash-popup-state slash-popup-state--error">
            {error}
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div className="slash-popup-state">
            {query
              ? `No ${typeLabel.toLowerCase()} match "${query}"`
              : `No ${typeLabel.toLowerCase()} registered for this app`}
          </div>
        )}

        {filtered.map((tool, i) => (
          <button
            key={tool.tool_key}
            className={`slash-popup-item${i === selectedIdx ? " is-selected" : ""}`}
            role="option"
            aria-selected={i === selectedIdx}
            onClick={() => onSelect(tool)}
            onMouseEnter={() => onHover(i)}
            tabIndex={-1}
            type="button"
          >
            <span className="slash-popup-text">
              <span className="slash-popup-label">
                {formatName(tool.display_name || tool.name)}
              </span>
              <span className="slash-popup-desc">{generateDesc(tool)}</span>
            </span>
          </button>
        ))}
      </div>

      {!isLoading && filtered.length > 0 && (
        <div className="slash-popup-footer">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>Esc back</span>
        </div>
      )}
    </div>
  );
};

/** Filtered (non-system) tool list for keyboard nav — mirrors the component's own filter. */
export function filteredTools(
  tools: ToolDefinition[],
  query: string,
): ToolDefinition[] {
  return tools.filter((t) => {
    if (SYSTEM_TOOL_NAMES.has(t.name)) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      formatName(t.display_name || t.name).toLowerCase().includes(q) ||
      (t.display_name || t.name).toLowerCase().includes(q) ||
      (t.entity_name ?? "").toLowerCase().includes(q)
    );
  });
}
