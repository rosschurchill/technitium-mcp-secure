import { TechnitiumClient } from "../client.js";
import { ToolEntry } from "../types.js";

export function cacheTools(client: TechnitiumClient): ToolEntry[] {
  return [
    {
      definition: {
        name: "dns_flush_cache",
        description:
          "Flush the entire DNS cache. Forces all subsequent queries to be resolved fresh from upstream. Requires confirm=true to execute.",
        inputSchema: {
          type: "object",
          properties: {
            confirm: {
              type: "boolean",
              description:
                "Must be true to confirm cache flush. Without this, returns a warning instead.",
            },
          },
        },
      },
      readonly: false,
      handler: async (args) => {
        if (args.confirm !== true) {
          return JSON.stringify(
            {
              warning:
                "This will flush the entire DNS cache. All subsequent queries will be resolved fresh from upstream, which may temporarily increase latency. Set confirm=true to proceed.",
            },
            null,
            2
          );
        }
        const data = await client.callOrThrow("/api/cache/flush");
        return JSON.stringify(
          { success: true, message: "Cache flushed", ...data },
          null,
          2
        );
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
      readonly: true,
      handler: async () => {
        const data = await client.callOrThrow("/api/cache/zones/list");
        return JSON.stringify(data, null, 2);
      },
    },
  ];
}
