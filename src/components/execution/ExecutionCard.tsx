import { useState, useEffect, useRef, useCallback } from 'react';
import type { ExecutionState, ExecutionStep, StepStatus } from '../../execution/ExecutionTypes';
import { useExecutionContext } from '../../execution/ExecutionContext';
import '../../styles/ExecutionCard.scss';

// How long the card stays visible in its terminal state before the exit animation
const DISMISS_DELAY_COMPLETED_MS = 1600;
const DISMISS_DELAY_FAILED_MS    = 2200;
// Duration must match exec-card-out @keyframes in ExecutionCard.scss
const EXIT_ANIM_DURATION_MS = 340;

// ── ExecutionCard (single execution instance) ─────────────────────────────────

interface ExecutionCardProps {
  execution: ExecutionState;
  onDismiss: (id: string) => void;
}

const ExecutionCard = ({ execution, onDismiss }: ExecutionCardProps) => {
  const [collapsed, setCollapsed]     = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isTerminal = execution.status === 'completed' || execution.status === 'failed';
  const isDone     = execution.status === 'completed';
  const isFailed   = execution.status === 'failed';

  // Auto-dismiss after the terminal state is reached
  useEffect(() => {
    if (!isTerminal || isDismissing) return;

    const delay = isDone ? DISMISS_DELAY_COMPLETED_MS : DISMISS_DELAY_FAILED_MS;

    dismissTimer.current = setTimeout(() => {
      setIsDismissing(true);
      exitTimer.current = setTimeout(() => onDismiss(execution.id), EXIT_ANIM_DURATION_MS);
    }, delay);

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      if (exitTimer.current)    clearTimeout(exitTimer.current);
    };
  }, [isTerminal, isDismissing, isDone, execution.id, onDismiss]);

  const doneCount  = execution.steps.filter(s => s.status === 'completed').length;
  const totalCount = execution.steps.length;

  const headerText = isFailed ? 'Action Failed' : isDone ? 'Completed' : 'Running Action';

  const cardClass = [
    'exec-card',
    isDone       ? 'exec-card--done'      : '',
    isFailed     ? 'exec-card--failed'    : '',
    isDismissing ? 'exec-card--dismissing' : '',
  ].filter(Boolean).join(' ');

  const trackClass = [
    'exec-card-track',
    isDone   ? 'exec-card-track--done'   : '',
    isFailed ? 'exec-card-track--failed' : '',
  ].filter(Boolean).join(' ');

  const dotClass = [
    'exec-card-status-dot',
    isDone   ? 'exec-card-status-dot--done'   : '',
    isFailed ? 'exec-card-status-dot--failed' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClass} role="status" aria-live="polite" aria-label={headerText}>

      {/* ── Animated gradient track at the very top ── */}
      <div className={trackClass} aria-hidden="true">
        {!isTerminal && <span className="exec-card-track-sweep" />}
      </div>

      {/* ── Header ── */}
      <div className="exec-card-header">
        <div className="exec-card-header-left">
          <span className={dotClass} aria-hidden="true" />
          <span className="exec-card-title">{headerText}</span>
        </div>

        {totalCount > 0 && (
          <div className="exec-card-header-right">
            <span className="exec-card-counter" aria-label={`${doneCount} of ${totalCount} steps done`}>
              {doneCount}/{totalCount}
            </span>
            <button
              className="exec-card-toggle"
              onClick={() => setCollapsed(c => !c)}
              aria-label={collapsed ? 'Expand steps' : 'Collapse steps'}
              aria-expanded={!collapsed}
            >
              <ChevronIcon collapsed={collapsed} />
            </button>
          </div>
        )}
      </div>

      {/* ── Collapsible step list ── */}
      <div
        className={`exec-card-steps${collapsed ? ' exec-card-steps--collapsed' : ''}`}
        aria-hidden={collapsed}
      >
        <div className="exec-card-steps-inner">
          {execution.steps.map((step, i) => (
            <StepRow key={step.id} step={step} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
};

// ── StepRow ───────────────────────────────────────────────────────────────────

const StepRow = ({ step, index }: { step: ExecutionStep; index: number }) => (
  <div
    className={`exec-card-step exec-card-step--${step.status}`}
    style={{ animationDelay: `${index * 0.045}s` }}
    aria-label={`${step.label}: ${step.status}`}
  >
    <span className="exec-card-step-icon">
      <StepIcon status={step.status} />
    </span>
    <span className="exec-card-step-label">{step.label}</span>
  </div>
);

// ── StepIcon ──────────────────────────────────────────────────────────────────
// Keyed on `status` so React remounts the wrapper on each transition, which
// re-triggers the CSS enter animation (check pop, error shake, etc.).

const StepIcon = ({ status }: { status: StepStatus }) => (
  <span
    key={status}
    className={`exec-card-step-icon-inner exec-card-step-icon-inner--${status}`}
  >
    {status === 'running'   && <span className="exec-card-spinner" aria-hidden="true" />}
    {status === 'completed' && <CheckIcon />}
    {status === 'failed'    && <ErrorIcon />}
    {status === 'pending'   && <PendingIcon />}
  </span>
);

// ── Collapse chevron ──────────────────────────────────────────────────────────

const ChevronIcon = ({ collapsed }: { collapsed: boolean }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    aria-hidden="true"
    style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)' }}
  >
    <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ── Icon SVGs ─────────────────────────────────────────────────────────────────

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeOpacity="0.4" />
    <path d="M3.5 6L5.5 8L8.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PendingIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeOpacity="0.35" strokeDasharray="2 2" />
  </svg>
);

const ErrorIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeOpacity="0.5" />
    <path d="M4 4L8 8M8 4L4 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// ── ActiveExecutionCards (rendered in ChatbotApp) ─────────────────────────────
// Reads all active executions from context and renders one card per execution.

export const ActiveExecutionCards = () => {
  const { executions, removeExecution } = useExecutionContext();
  const onDismiss = useCallback((id: string) => removeExecution(id), [removeExecution]);

  const cards = Array.from(executions.values());
  if (cards.length === 0) return null;

  return (
    <>
      {cards.map(exec => (
        <ExecutionCard key={exec.id} execution={exec} onDismiss={onDismiss} />
      ))}
    </>
  );
};

export default ExecutionCard;
