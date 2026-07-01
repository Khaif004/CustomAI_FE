import type { ExecStep } from "../../hooks/useChatbot";
import "../../styles/ExecutionLog.scss";

interface Props {
  steps: ExecStep[];
}

export const ExecutionLog = ({ steps }: Props) => {
  if (!steps.length) return null;

  const doneCount  = steps.filter((s) => s.status === "done").length;
  const totalSteps = steps[steps.length - 1]?.num ?? steps.length;
  const hasError   = steps.some((s) => s.status === "error");
  const isActive   = steps.some((s) => s.status === "active");
  const isDone     = !isActive && !hasError;

  const progressPct = isDone
    ? 100
    : Math.round((doneCount / Math.max(totalSteps, 1)) * 100);

  const headerText = hasError ? "Action Failed" : isDone ? "Completed" : "Running Action";

  return (
    <div
      className={[
        "exec-log",
        hasError ? "exec-log--error" : "",
        isDone    ? "exec-log--done"  : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Header */}
      <div className="exec-log-header">
        <div className="exec-log-header-left">
          <span className="exec-log-pulse" aria-hidden="true" />
          <span className="exec-log-title">{headerText}</span>
        </div>
        <span className="exec-log-counter" aria-label={`Step ${doneCount} of ${totalSteps}`}>
          {doneCount}/{totalSteps}
        </span>
      </div>

      {/* Progress bar */}
      <div className="exec-log-progress" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
        <div className="exec-log-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Steps */}
      <div className="exec-log-steps">
        {steps.map((step, i) => (
          <div
            key={step.id}
            className={`exec-log-step exec-log-step--${step.status}`}
            style={{ animationDelay: `${i * 0.06}s` }}
          >
            <span className="exec-log-step-icon" aria-hidden="true">
              {step.status === "done"    && <DoneIcon />}
              {step.status === "active"  && <span className="exec-log-spinner" />}
              {step.status === "pending" && <PendingIcon />}
              {step.status === "error"   && <ErrorIcon />}
            </span>
            <span className="exec-log-step-label">{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const DoneIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeOpacity="0.4" />
    <path d="M3.5 6L5.5 8L8.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PendingIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeOpacity="0.35" strokeDasharray="2 2" />
  </svg>
);

const ErrorIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeOpacity="0.5" />
    <path d="M4 4L8 8M8 4L4 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
