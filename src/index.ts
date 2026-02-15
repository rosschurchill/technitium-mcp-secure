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
import { audit } from "./audit.js";
import { RateLimiter } from "./rate-limit.js";
import { sanitizeError, sanitizeResponse, maskUrl } from "./sanitize.js";

const VERSION = "1.2.0";

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new TechnitiumClient(config);
  const allTools = getAllTools(client);

  // Filter out write tools in readonly mode
  const tools = config.readonly
    ? allTools.filter((t) => t.readonly)
    : allTools;

  if (config.readonly) {
    audit.logSecurity(
      "readonly_mode",
      `Exposing ${tools.length} of ${allTools.length} tools (write tools hidden)`
    );
  }

  const toolMap = new Map(tools.map((t) => [t.definition.name, t]));
  const rateLimiter = new RateLimiter();

  const server = new Server(
    { name: "technitium-mcp", version: VERSION },
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
          { type: "text" as const, text: JSON.stringify({ error: `Unknown tool: ${name}` }) },
        ],
        isError: true,
      };
    }

    // Rate limit check
    const rateCheck = rateLimiter.check(name);
    if (!rateCheck.allowed) {
      audit.logSecurity("rate_limited", `Tool ${name} rate limited`);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: "Rate limited",
              retryAfterMs: rateCheck.retryAfterMs,
            }),
          },
        ],
        isError: true,
      };
    }

    const startTime = Date.now();

    try {
      const rawResult = await tool.handler((args || {}) as Record<string, unknown>);

      // Sanitize the response
      let sanitized: string;
      try {
        const parsed = JSON.parse(rawResult);
        sanitized = JSON.stringify(sanitizeResponse(parsed), null, 2);
      } catch {
        sanitized = rawResult;
      }

      audit.logToolCall(
        name,
        (args || {}) as Record<string, unknown>,
        "success",
        Date.now() - startTime
      );

      return {
        content: [{ type: "text" as const, text: sanitized }],
      };
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error);
      const message = sanitizeError(rawMessage);

      audit.logToolCall(
        name,
        (args || {}) as Record<string, unknown>,
        "error",
        Date.now() - startTime,
        message
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: message }),
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
    audit.logShutdown(signal);
    client.clearToken();
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  const transport = new StdioServerTransport();
  audit.logStartup(VERSION, maskUrl(config.url));
  await server.connect(transport);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  audit.logSecurity("fatal_error", sanitizeError(message));
  process.exit(1);
});
