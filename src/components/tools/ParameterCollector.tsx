import {
  useState,
  useEffect,
  useRef,
  type FC,
  type RefObject,
} from "react";
import type { ToolDefinition, ToolParameter } from "../../types/tools";

interface Props {
  tool: ToolDefinition;
  step: number;
  params: Record<string, unknown>;
  onSubmit: (paramName: string, value: unknown) => void;
  onBack: () => void;
  onCancel: () => void;
}

export const ParameterCollector: FC<Props> = ({
  tool,
  step,
  params,
  onSubmit,
  onBack,
  onCancel,
}) => {
  const param = tool.parameters[step];
  const [value, setValue] = useState<string | boolean>(() => {
    const existing = params[param?.name];
    if (existing === undefined || existing === null) {
      return param?.type === "Boolean" ? false : "";
    }
    return param?.type === "Boolean"
      ? Boolean(existing)
      : String(existing);
  });
  const [validationError, setValidationError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset local state whenever the step (or parameter) changes
  useEffect(() => {
    if (!param) return;
    const existing = params[param.name];
    if (existing === undefined || existing === null) {
      setValue(param.type === "Boolean" ? false : "");
    } else {
      setValue(param.type === "Boolean" ? Boolean(existing) : String(existing));
    }
    setValidationError("");
  }, [step, param?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep focus on the primary input when the step changes
  useEffect(() => {
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [step]);

  if (!param) return null;

  const totalSteps = tool.parameters.length;
  const toolName = tool.display_name || tool.name;
  const isLastStep = step === totalSteps - 1;

  const validate = (): boolean => {
    const strVal = String(value).trim();
    if (param.required && strVal === "" && param.type !== "Boolean") {
      setValidationError(
        `${param.description || param.name} is required`,
      );
      return false;
    }
    if (
      (param.type === "Integer") &&
      strVal !== "" &&
      !Number.isInteger(Number(strVal))
    ) {
      setValidationError("Must be a whole number");
      return false;
    }
    if (param.type === "Decimal" && strVal !== "" && isNaN(Number(strVal))) {
      setValidationError("Must be a number");
      return false;
    }
    return true;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit(param.name, coerceValue(value, param.type));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="param-collector">
      <div className="param-collector-header">
        <div className="param-collector-tool-name">{toolName}</div>
        <div className="param-collector-step-badge">
          {step + 1} / {totalSteps}
        </div>
        <button
          className="param-collector-cancel-btn"
          onClick={onCancel}
          title="Cancel"
          type="button"
          aria-label="Cancel"
        >
          ✕
        </button>
      </div>

      <div className="param-collector-body">
        <label className="param-label" htmlFor="param-input">
          {param.description || param.name}
          {param.required && (
            <span className="param-required" aria-label="required">
              *
            </span>
          )}
        </label>

        <div className="param-input-wrapper">
          {renderParamInput({
            param,
            value,
            setValue,
            inputRef,
            onKeyDown: handleKeyDown,
          })}
        </div>

        {validationError && (
          <div className="param-error" role="alert">
            {validationError}
          </div>
        )}
      </div>

      <div className="param-collector-footer">
        <button
          className="param-back-btn"
          onClick={onBack}
          type="button"
        >
          ← Back
        </button>
        <button
          className="param-next-btn"
          onClick={handleSubmit}
          type="button"
        >
          {isLastStep ? "Review →" : "Next →"}
        </button>
      </div>
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function coerceValue(value: string | boolean, type: string): unknown {
  if (type === "Boolean") return Boolean(value);
  const str = String(value).trim();
  if (str === "") return null;
  if (type === "Integer") return parseInt(str, 10);
  if (type === "Decimal") return parseFloat(str);
  return str;
}

interface InputProps {
  param: ToolParameter;
  value: string | boolean;
  setValue: (v: string | boolean) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

function renderParamInput({
  param,
  value,
  setValue,
  inputRef,
  onKeyDown,
}: InputProps) {
  switch (param.type) {
    case "Boolean":
      return (
        <label className="param-switch">
          <input
            id="param-input"
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => setValue(e.target.checked)}
            ref={inputRef as RefObject<HTMLInputElement>}
            aria-label={param.description || param.name}
          />
          <span className="param-switch-track" aria-hidden="true" />
          <span className="param-switch-label">
            {value ? "Yes" : "No"}
          </span>
        </label>
      );

    case "Integer":
      return (
        <input
          id="param-input"
          ref={inputRef}
          type="number"
          step="1"
          className="param-input"
          value={value as string}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`Enter ${param.description || param.name}`}
          aria-required={param.required}
        />
      );

    case "Decimal":
      return (
        <input
          id="param-input"
          ref={inputRef}
          type="number"
          step="any"
          className="param-input"
          value={value as string}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`Enter ${param.description || param.name}`}
          aria-required={param.required}
        />
      );

    case "Date":
      return (
        <input
          id="param-input"
          ref={inputRef}
          type="date"
          className="param-input"
          value={value as string}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          aria-required={param.required}
        />
      );

    case "DateTime":
      return (
        <input
          id="param-input"
          ref={inputRef}
          type="datetime-local"
          className="param-input"
          value={value as string}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          aria-required={param.required}
        />
      );

    default:
      // String, UUID, and any future type → plain text input
      return (
        <input
          id="param-input"
          ref={inputRef}
          type="text"
          className="param-input"
          value={value as string}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`Enter ${param.description || param.name}`}
          aria-required={param.required}
          maxLength={param.length ?? undefined}
        />
      );
  }
}
