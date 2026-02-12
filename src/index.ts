#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadConfig } from "./config.js";
import { TechnitiumClient } from "./client.js";
import { getAllTools } from "./tools/index.js";

function log(message: string): void {
  console.error(`[technitium-mcp] ${message}`);
}

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new TechnitiumClient(config);
  const tools = getAllTools(client);

  const toolMap = new Map(tools.map((t) => [t.definition.name, t]));

  const server = new Server(
    { name: "technitium-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => t.definition),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = toolMap.get(name);

    if (!tool) {
      return {
        content: [
          { type: "text", text: JSON.stringify({ error: `Unknown tool: ${name}` }) },
        ],
      };
    }

    try {
      const result = await tool.handler((args || {}) as Record<string, unknown>);
      return {
        content: [{ type: "text", text: result }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`Tool ${name} failed: ${message}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: message }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`Received ${signal}, shutting down...`);
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  const transport = new StdioServerTransport();
  log(`Connecting to ${config.url}`);
  await server.connect(transport);
  log("Server running on stdio");
}

main().catch((error) => {
  log(`Fatal error: ${error}`);
  process.exit(1);
});
