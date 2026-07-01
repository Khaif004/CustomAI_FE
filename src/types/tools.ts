export type ToolType =
  | 'ACTION'
  | 'FUNCTION'
  | 'UI_ACTION'
  | 'NAVIGATION'
  | 'REPORT'
  | 'DOCUMENT'
  | 'WORKFLOW'
  | 'UI'
  | 'API';

export type ToolBinding = 'bound' | 'unbound';

export interface ToolParameter {
  name: string;
  /** OData / CDS primitive type, e.g. 'String', 'Integer', 'Boolean', 'UUID', 'Date', 'DateTime', 'Decimal' */
  type: string;
  cds_type?: string;
  required: boolean;
  is_collection?: boolean;
  length?: number;
  description?: string;
}

export interface ToolAuthorization {
  required_roles?: string[];
  restrictions?: string[];
}

export interface ToolDefinition {
  tool_key: string;
  tool_type: ToolType;
  binding: ToolBinding;
  name: string;
  display_name?: string;
  description?: string;
  service_name?: string;
  entity_name?: string;
  bound_entity?: string;
  http_method?: string;
  http_endpoint?: string;
  /** CustomEvent name dispatched by the widget for UI_ACTION tools. */
  frontend_event?: string;
  parameters: ToolParameter[];
  required_parameters: string[];
  return_type?: string;
  authorization?: ToolAuthorization;
  cds_name?: string;
}

export interface ToolListResponse {
  app_id: string;
  tool_count: number;
  tools: ToolDefinition[];
}

export interface ExecutionError {
  code: string;
  message: string;
  detail?: string;
  field?: string;
}

export interface ActionExecutionResult {
  status: string;
  tool_key: string;
  app_id: string;
  success: boolean;
  http_status_code?: number;
  result?: unknown;
  messages?: string[];
  error?: ExecutionError;
  execution_time_ms?: number;
  requires_confirmation?: boolean;
}

/** Emitted by the backend as a tool_call SSE event when the LLM identifies a tool intent. */
export interface ToolCallEvent {
  tool_key: string;
  entity_key?: string;
  parameters?: Record<string, unknown>;
  confidence?: number;
}

// ── State machine ─────────────────────────────────────────────────────────────

export type ToolExecPhase =
  | 'idle'
  | 'param_collection'
  | 'confirmation'
  | 'executing';

export interface ToolExecState {
  phase: ToolExecPhase;
  selectedTool?: ToolDefinition;
  params?: Record<string, unknown>;
  paramStep?: number;
  error?: string;
  /** True when executing without a preceding confirmation card (FUNCTION or no-confirmation ACTION). */
  directExecute?: boolean;
}
