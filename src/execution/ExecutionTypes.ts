export type StepStatus = "pending" | "running" | "completed" | "failed";
export type ExecutionStatus = "idle" | "running" | "completed" | "failed";

export interface ExecutionStep {
  id: string;
  label: string;
  status: StepStatus;
  error?: string;
}

export interface ExecutionState {
  id: string;
  label: string;
  status: ExecutionStatus;
  steps: ExecutionStep[];
  startedAt: number;
  completedAt?: number;
  error?: string;
}
