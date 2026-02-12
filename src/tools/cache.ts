import { TechnitiumClient } from "../client.js";
import { ToolEntry } from "../types.js";

export function cacheTools(client: TechnitiumClient): ToolEntry[] {
  return [
    {
      definition: {
        name: "dns_flush_cache",
        description:
          "Flush the entire DNS cache. Forces all subsequent queries to be resolved fresh from upstream.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      handler: async () => {
        const data = await client.callOrThrow("/api/cache/flush");
        return JSON.stringify({ success: true, message: "Cache flushed", ...data }, null, 2);
      },
    },
    {
      definition: {
        name: "dns_list_cache",
        description: "List all zones currently in the DNS cache.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      handler: async () => {
        const data = await client.callOrThrow("/api/cache/zones/list");
        return JSON.stringify(data, null, 2);
      },
    },
  ];
}
