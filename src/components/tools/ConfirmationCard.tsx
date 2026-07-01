import { useEffect, useRef, type FC } from "react";
import type { ToolDefinition } from "../../types/tools";

interface Props {
  tool: ToolDefinition;
  params: Record<string, unknown>;
  isExecuting: boolean;
  onConfirm: () => void;
  onBack: () => void;
  onCancel: () => void;
}

export const ConfirmationCard: FC<Props> = ({
  tool,
  params,
  isExecuting,
  onConfirm,
  onBack,
  onCancel,
}) => {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // Auto-focus the Execute button so Enter confirms immediately
  useEffect(() => {
    const raf = requestAnimationFrame(() => confirmBtnRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, []);

  const toolName = tool.display_name || tool.name;
  const typeLabel = tool.tool_type === "FUNCTION" ? "function" : "action";

  // Filter out null / undefined / empty values for the summary
  const paramEntries = Object.entries(params).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );

  const getParamLabel = (name: string) =>
    tool.parameters.find((p) => p.name === name)?.description || name;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && !isExecuting) {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div
      className="confirmation-card"
      role="dialog"
      aria-label={`Confirm ${toolName}`}
      onKeyDown={handleKeyDown}
    >
      <div className="confirmation-header">
        <div className="confirmation-tool-name">{toolName}</div>
        <button
          className="confirmation-x-btn"
          onClick={onCancel}
          disabled={isExecuting}
          type="button"
          aria-label="Cancel"
        >
          ✕
        </button>
      </div>

      {tool.description && (
        <p className="confirmation-description">{tool.description}</p>
      )}

      {paramEntries.length > 0 && (
        <div className="confirmation-params" aria-label="Parameters">
          {paramEntries.map(([key, val]) => (
            <div key={key} className="confirmation-param-row">
              <span className="confirmation-param-key">
                {getParamLabel(key)}
              </span>
              <span className="confirmation-param-val">{String(val)}</span>
            </div>
          ))}
        </div>
      )}

      <p className="confirmation-prompt">Execute this {typeLabel}?</p>

      <div className="confirmation-actions">
        <button
          className="confirmation-back-btn"
          onClick={onBack}
          disabled={isExecuting}
          type="button"
        >
          ← Back
        </button>

        <div className="confirmation-actions-right">
          <button
            className="confirmation-cancel-btn"
            onClick={onCancel}
            disabled={isExecuting}
            type="button"
          >
            Cancel
          </button>

          <button
            ref={confirmBtnRef}
            className="confirmation-execute-btn"
            onClick={onConfirm}
            disabled={isExecuting}
            type="button"
            aria-busy={isExecuting}
          >
            {isExecuting && (
              <span className="exec-spinner" aria-hidden="true" />
            )}
            {isExecuting ? "Executing…" : "Execute"}
          </button>
        </div>
      </div>
    </div>
  );
};
