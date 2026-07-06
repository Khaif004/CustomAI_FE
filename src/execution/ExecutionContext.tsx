import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
} from "react";
import type { ReactNode } from "react";
import { executionBus } from "./ExecutionEventBus";
import type { ExecutionState, ExecutionStep } from "./ExecutionTypes";

// ── Pipeline metadata ─────────────────────────────────────────────────────────

const STEP_PIPELINE = ["analyzing", "found", "preparing", "executing"] as const;
type PipelineStep = (typeof STEP_PIPELINE)[number];

const PENDING_LABELS: Record<PipelineStep, string> = {
  analyzing: "Analyzing your request",
  found: "Identifying action",
  preparing: "Preparing request",
  executing: "Executing action",
};

// ── Reducer ───────────────────────────────────────────────────────────────────

type ExecMap = Map<string, ExecutionState>;

type Action =
  | { type: "execution_started"; id: string; label: string }
  | { type: "step_started"; executionId: string; stepId: string; label: string }
  | { type: "step_completed"; executionId: string; stepId: string }
  | { type: "step_failed"; executionId: string; stepId: string; error?: string }
  | { type: "execution_completed"; executionId: string }
  | { type: "execution_failed"; executionId: string; error?: string }
  | { type: "remove_execution"; executionId: string };

function reducer(state: ExecMap, action: Action): ExecMap {
  switch (action.type) {
    case "execution_started": {
      const next = new Map(state);
      next.set(action.id, {
        id: action.id,
        label: action.label,
        status: "running",
        steps: [],
        startedAt: Date.now(),
      });
      return next;
    }

    case "step_started": {
      const exec = state.get(action.executionId);
      if (!exec) return state;

      // Complete any running step and drop stale pending placeholders
      const completedSteps: ExecutionStep[] = exec.steps
        .filter((s) => s.status !== "pending")
        .map((s) =>
          s.status === "running" ? { ...s, status: "completed" as const } : s,
        );

      const newRunning: ExecutionStep = {
        id: action.stepId,
        label: action.label,
        status: "running",
      };

      // Add pending placeholders for subsequent pipeline steps
      const pipelineIdx = STEP_PIPELINE.indexOf(action.stepId as PipelineStep);
      const pendingSteps: ExecutionStep[] =
        pipelineIdx >= 0
          ? STEP_PIPELINE.slice(pipelineIdx + 1).map((id) => ({
              id,
              label: PENDING_LABELS[id],
              status: "pending" as const,
            }))
          : [];

      const next = new Map(state);
      next.set(action.executionId, {
        ...exec,
        steps: [...completedSteps, newRunning, ...pendingSteps],
      });
      return next;
    }

    case "step_completed": {
      const exec = state.get(action.executionId);
      if (!exec) return state;
      const next = new Map(state);
      next.set(action.executionId, {
        ...exec,
        steps: exec.steps.map((s) =>
          s.id === action.stepId ||
          (action.stepId === "_last" && s.status === "running")
            ? { ...s, status: "completed" as const }
            : s,
        ),
      });
      return next;
    }

    case "step_failed": {
      const exec = state.get(action.executionId);
      if (!exec) return state;
      const next = new Map(state);
      next.set(action.executionId, {
        ...exec,
        steps: exec.steps.map((s) =>
          s.id === action.stepId ||
          (action.stepId === "_last" && s.status === "running")
            ? { ...s, status: "failed" as const, error: action.error }
            : s,
        ),
      });
      return next;
    }

    case "execution_completed": {
      const exec = state.get(action.executionId);
      if (!exec) return state;
      const next = new Map(state);
      next.set(action.executionId, {
        ...exec,
        status: "completed",
        completedAt: Date.now(),
        steps: exec.steps
          .filter((s) => s.status !== "pending")
          .map((s) =>
            s.status === "running" ? { ...s, status: "completed" as const } : s,
          ),
      });
      return next;
    }

    case "execution_failed": {
      const exec = state.get(action.executionId);
      if (!exec) return state;
      const next = new Map(state);
      next.set(action.executionId, {
        ...exec,
        status: "failed",
        completedAt: Date.now(),
        error: action.error,
        steps: exec.steps
          .filter((s) => s.status !== "pending")
          .map((s) =>
            s.status === "running" ? { ...s, status: "failed" as const } : s,
          ),
      });
      return next;
    }

    case "remove_execution": {
      const next = new Map(state);
      next.delete(action.executionId);
      return next;
    }

    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

interface ExecutionContextValue {
  executions: ExecMap;
  removeExecution: (id: string) => void;
}

const ExecutionContext = createContext<ExecutionContextValue>({
  executions: new Map(),
  removeExecution: () => {},
});

export const ExecutionProvider = ({ children }: { children: ReactNode }) => {
  const [executions, dispatch] = useReducer(
    reducer,
    new Map<string, ExecutionState>(),
  );

  useEffect(() => {
    const unsubs = [
      executionBus.on("execution:started", ({ executionId, label }) =>
        dispatch({ type: "execution_started", id: executionId, label }),
      ),
      executionBus.on(
        "execution:step_started",
        ({ executionId, stepId, label }) =>
          dispatch({ type: "step_started", executionId, stepId, label }),
      ),
      executionBus.on("execution:step_completed", ({ executionId, stepId }) =>
        dispatch({ type: "step_completed", executionId, stepId }),
      ),
      executionBus.on(
        "execution:step_failed",
        ({ executionId, stepId, error }) =>
          dispatch({ type: "step_failed", executionId, stepId, error }),
      ),
      executionBus.on("execution:completed", ({ executionId }) =>
        dispatch({ type: "execution_completed", executionId }),
      ),
      executionBus.on("execution:failed", ({ executionId, error }) =>
        dispatch({ type: "execution_failed", executionId, error }),
      ),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, []);

  const removeExecution = useCallback(
    (id: string) => dispatch({ type: "remove_execution", executionId: id }),
    [],
  );

  return (
    <ExecutionContext.Provider value={{ executions, removeExecution }}>
      {children}
    </ExecutionContext.Provider>
  );
};

export const useExecutionContext = () => useContext(ExecutionContext);
