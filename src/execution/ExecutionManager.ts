import { executionBus } from "./ExecutionEventBus";

export interface ExecStatusEvent {
  step: string;
  tool?: string;
  message?: string;
  entity?: string;
  step_num?: number;
  total_steps?: number;
}

type LabelFn = (ev: ExecStatusEvent) => string;

const STEP_LABEL_FNS: Record<string, LabelFn> = {
  analyzing: () => "Analyzing your request",
  found: (ev) => `Identified: ${ev.tool ?? "action"}`,
  preparing: (ev) => `Preparing${ev.entity ? ` for ${ev.entity}` : ""} request`,
  executing: () => "Sending to CAP service",
};

function getStepLabel(step: string, ev: ExecStatusEvent): string {
  const fn = STEP_LABEL_FNS[step];
  return fn ? fn(ev) : step;
}

class ExecutionManager {
  private activeExecId: string | null = null;
  private activeStepId: string | null = null;

  handleExecStatus(ev: ExecStatusEvent): void {
    const { step } = ev;

    // Start a fresh execution on the first pipeline step
    if (step === "analyzing" || !this.activeExecId) {
      if (this.activeExecId) {
        // Orphaned execution — force-fail it
        executionBus.emit("execution:failed", {
          executionId: this.activeExecId,
        });
      }
      this.activeExecId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      this.activeStepId = null;
      executionBus.emit("execution:started", {
        executionId: this.activeExecId,
        label: "Running Action",
      });
    }

    const execId = this.activeExecId!;

    if (step === "success") {
      if (this.activeStepId) {
        executionBus.emit("execution:step_completed", {
          executionId: execId,
          stepId: this.activeStepId,
        });
      }
      executionBus.emit("execution:completed", { executionId: execId });
      this.activeExecId = null;
      this.activeStepId = null;
      return;
    }

    if (step === "error") {
      if (this.activeStepId) {
        executionBus.emit("execution:step_failed", {
          executionId: execId,
          stepId: this.activeStepId,
          error: ev.message,
        });
      }
      executionBus.emit("execution:failed", {
        executionId: execId,
        error: ev.message,
      });
      this.activeExecId = null;
      this.activeStepId = null;
      return;
    }

    // Complete the previously active step before starting the next
    if (this.activeStepId) {
      executionBus.emit("execution:step_completed", {
        executionId: execId,
        stepId: this.activeStepId,
      });
    }

    this.activeStepId = step;
    executionBus.emit("execution:step_started", {
      executionId: execId,
      stepId: step,
      label: getStepLabel(step, ev),
    });
  }

  handleToolResult(): void {
    // Safety net: tool_result arrived before exec_status:success
    if (this.activeExecId) {
      if (this.activeStepId) {
        executionBus.emit("execution:step_completed", {
          executionId: this.activeExecId,
          stepId: this.activeStepId,
        });
      }
      executionBus.emit("execution:completed", {
        executionId: this.activeExecId,
      });
      this.activeExecId = null;
      this.activeStepId = null;
    }
  }

  reset(): void {
    if (this.activeExecId) {
      executionBus.emit("execution:failed", { executionId: this.activeExecId });
      this.activeExecId = null;
      this.activeStepId = null;
    }
  }
}

export const executionManager = new ExecutionManager();
