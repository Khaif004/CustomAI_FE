import { useState, useCallback, useRef } from "react";
import type {
  ToolExecState,
  ToolDefinition,
  ActionExecutionResult,
} from "../types/tools";
import { toolsApi } from "../services/api";

const ENTITY_KEY_PARAM_NAME = "__entity_key__";

function formatResult(
  result: ActionExecutionResult,
  tool: ToolDefinition,
): string {
  const name = tool.display_name || tool.name;
  if (result.success) {
    const msgs = result.messages?.filter(Boolean).join("\n") ?? "";
    return `✅ ${name} completed successfully.${msgs ? "\n" + msgs : ""}`;
  }
  const errMsg =
    result.error?.message ??
    result.messages?.filter(Boolean).join("\n") ??
    "Unknown error";
  return `❌ ${name} failed: ${errMsg}`;
}

/**
 * @param appId        Application ID passed to every API call.
 * @param onResult     Called with a formatted message when execution finishes.
 * @param getOdataToken Optional callback returning the current OData bearer token.
 */
export const useToolExecution = (
  appId: string | null,
  onResult: (message: string) => void,
  getOdataToken?: () => string | undefined,
) => {
  const [state, setState] = useState<ToolExecState>({ phase: "idle" });

  const stateRef = useRef<ToolExecState>(state);
  stateRef.current = state;

  const reset = useCallback(() => setState({ phase: "idle" }), []);

  // ── Core execution ────────────────────────────────────────────────────────

  const _execute = useCallback(
    async (
      tool: ToolDefinition,
      params: Record<string, unknown>,
      odataToken?: string,
      direct = false,
    ) => {
      if (!appId) return;

      const entityKey = params[ENTITY_KEY_PARAM_NAME] as string | undefined;
      const cleanParams = { ...params };
      delete cleanParams[ENTITY_KEY_PARAM_NAME];

      setState((prev) => ({
        ...prev,
        phase: "executing",
        directExecute: direct,
      }));
      try {
        const result = await toolsApi.executeTool(
          appId,
          tool.tool_key,
          cleanParams,
          entityKey || undefined,
          odataToken,
        );

        // UI_ACTION: dispatch a browser CustomEvent + postMessage to Fiori parent
        const resultData = result.result as Record<string, unknown> | null | undefined;
        if (resultData?.executionType === "UI_ACTION") {
          const eventName = resultData.frontendEvent as string;
          const payload = resultData.payload ?? {};
          if (eventName) {
            window.dispatchEvent(
              new CustomEvent(eventName, { detail: payload, bubbles: true }),
            );
            window.parent.postMessage(
              { type: "btp-copilot:ui-action", event: eventName, payload },
              "*",
            );
          }
        }

        onResult(formatResult(result, tool));
      } catch (err) {
        const name = tool.display_name || tool.name;
        const msg = err instanceof Error ? err.message : "Unknown error";
        onResult(`❌ Failed to execute ${name}: ${msg}`);
      } finally {
        setState({ phase: "idle" });
      }
    },
    [appId, onResult],
  );

  const _proceedAfterParams = useCallback(
    async (tool: ToolDefinition, collectedParams: Record<string, unknown>) => {
      if (!appId) return;

      if (tool.tool_type === "FUNCTION" || tool.tool_type === "UI_ACTION") {
        await _execute(tool, collectedParams, getOdataToken?.(), true);
        return;
      }

      try {
        const requiresConfirmation = await toolsApi.checkConfirmation(
          appId,
          tool.tool_key,
        );
        if (requiresConfirmation) {
          setState((prev) => ({
            ...prev,
            phase: "confirmation",
            params: collectedParams,
          }));
        } else {
          await _execute(tool, collectedParams, getOdataToken?.(), true);
        }
      } catch {
        setState((prev) => ({
          ...prev,
          phase: "confirmation",
          params: collectedParams,
        }));
      }
    },
    [appId, _execute, getOdataToken],
  );

  // ── Public state-machine transitions ──────────────────────────────────────

  /**
   * Select a tool (called from ToolPicker or triggerFromNL after tool is resolved).
   * Prepends a synthetic entity-key parameter for bound tools.
   */
  const selectTool = useCallback(
    async (tool: ToolDefinition) => {
      const effectiveTool: ToolDefinition =
        tool.binding === "bound"
          ? {
              ...tool,
              parameters: [
                {
                  name: ENTITY_KEY_PARAM_NAME,
                  type: "String",
                  required: true,
                  is_collection: false,
                  description: tool.bound_entity
                    ? `${tool.bound_entity} ID`
                    : "Record ID",
                },
                ...tool.parameters,
              ],
            }
          : tool;

      const hasParams = effectiveTool.parameters.length > 0;
      if (hasParams) {
        setState({
          phase: "param_collection",
          selectedTool: effectiveTool,
          params: {},
          paramStep: 0,
        });
      } else {
        setState({ phase: "idle", selectedTool: effectiveTool, params: {} });
        await _proceedAfterParams(effectiveTool, {});
      }
    },
    [_proceedAfterParams],
  );

  /**
   * Entry point from a natural-language tool_call SSE event.
   *
   * Fetches the tool definition, pre-fills known params (including entity_key
   * for bound tools), then either starts param collection for missing required
   * params or jumps straight to confirmation / execution.
   */
  const triggerFromNL = useCallback(
    async (
      toolKey: string,
      entityKey?: string,
      prefilledParams: Record<string, unknown> = {},
    ) => {
      if (!appId) return;
      try {
        const allTools = await toolsApi.listTools(appId);
        const tool = allTools.find((t) => t.tool_key === toolKey);
        if (!tool) {
          onResult(`Tool '${toolKey}' not found for app '${appId}'.`);
          return;
        }

        // Build the effective tool with synthetic entity-key param for bound ops
        const effectiveTool: ToolDefinition =
          tool.binding === "bound"
            ? {
                ...tool,
                parameters: [
                  {
                    name: ENTITY_KEY_PARAM_NAME,
                    type: "String",
                    required: true,
                    is_collection: false,
                    description: tool.bound_entity
                      ? `${tool.bound_entity} ID`
                      : "Record ID",
                  },
                  ...tool.parameters,
                ],
              }
            : tool;

        // Seed params: inject entity_key if known, plus any NL-provided params
        const seedParams: Record<string, unknown> = { ...prefilledParams };
        if (tool.binding === "bound" && entityKey) {
          seedParams[ENTITY_KEY_PARAM_NAME] = entityKey;
        }

        // Find first missing required parameter
        const firstMissing = effectiveTool.parameters.findIndex(
          (p) => p.required && seedParams[p.name] === undefined,
        );

        if (firstMissing >= 0) {
          setState({
            phase: "param_collection",
            selectedTool: effectiveTool,
            params: seedParams,
            paramStep: firstMissing,
          });
        } else {
          setState({
            phase: "idle",
            selectedTool: effectiveTool,
            params: seedParams,
          });
          await _proceedAfterParams(effectiveTool, seedParams);
        }
      } catch (err) {
        onResult(
          `Failed to trigger '${toolKey}': ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    },
    [appId, onResult, _proceedAfterParams],
  );

  /**
   * Advance the parameter-collection wizard by one step.
   */
  const submitParam = useCallback(
    async (paramName: string, value: unknown) => {
      const prev = stateRef.current;
      if (prev.phase !== "param_collection" || !prev.selectedTool) return;

      const newParams = { ...(prev.params ?? {}), [paramName]: value };
      const nextStep = (prev.paramStep ?? 0) + 1;
      const totalParams = prev.selectedTool.parameters.length;

      if (nextStep >= totalParams) {
        setState((s) =>
          s.phase === "param_collection" ? { ...s, params: newParams } : s,
        );
        await _proceedAfterParams(prev.selectedTool, newParams);
      } else {
        setState((s) =>
          s.phase === "param_collection"
            ? { ...s, params: newParams, paramStep: nextStep }
            : s,
        );
      }
    },
    [_proceedAfterParams],
  );

  const goBack = useCallback(() => {
    setState((prev) => {
      if (prev.phase === "confirmation") {
        const tool = prev.selectedTool;
        if (!tool?.parameters?.length) {
          return { phase: "idle" };
        }
        return {
          phase: "param_collection",
          selectedTool: tool,
          params: prev.params,
          paramStep: Math.max(0, tool.parameters.length - 1),
        };
      }
      if (prev.phase === "param_collection") {
        const step = prev.paramStep ?? 0;
        if (step === 0) {
          return { phase: "idle" };
        }
        return { ...prev, paramStep: step - 1 };
      }
      return { phase: "idle" };
    });
  }, []);

  /**
   * Called when the user clicks Execute on the ConfirmationCard.
   */
  const executeConfirmed = useCallback(
    async (odataToken?: string) => {
      const { selectedTool, params = {} } = stateRef.current;
      if (!selectedTool || !appId) return;
      await _execute(selectedTool, params, odataToken, false);
    },
    [appId, _execute],
  );

  return {
    state,
    triggerFromNL,
    selectTool,
    submitParam,
    goBack,
    executeConfirmed,
    reset,
  };
};
