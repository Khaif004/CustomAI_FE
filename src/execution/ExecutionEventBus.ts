export interface ExecutionEventMap {
  "execution:started": { executionId: string; label: string };
  "execution:step_started": {
    executionId: string;
    stepId: string;
    label: string;
  };
  "execution:step_completed": { executionId: string; stepId: string };
  "execution:step_failed": {
    executionId: string;
    stepId: string;
    error?: string;
  };
  "execution:completed": { executionId: string };
  "execution:failed": { executionId: string; error?: string };
}

type EventType = keyof ExecutionEventMap;

class ExecutionEventBus {
  emit<T extends EventType>(type: T, payload: ExecutionEventMap[T]): void {
    window.dispatchEvent(
      new CustomEvent(type, { detail: payload, bubbles: false }),
    );
  }

  on<T extends EventType>(
    type: T,
    handler: (payload: ExecutionEventMap[T]) => void,
  ): () => void {
    const listener = (e: Event) =>
      handler((e as CustomEvent<ExecutionEventMap[T]>).detail);
    window.addEventListener(type, listener);
    return () => window.removeEventListener(type, listener);
  }
}

export const executionBus = new ExecutionEventBus();
