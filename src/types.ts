export interface TechnitiumResponse {
  status: "ok" | "error" | "invalid-token";
  response?: Record<string, unknown>;
  errorMessage?: string;
  stackTrace?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolHandler {
  (args: Record<string, unknown>): Promise<string>;
}

export interface ToolEntry {
  definition: ToolDefinition;
  handler: ToolHandler;
}
