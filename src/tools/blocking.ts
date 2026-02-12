import { TechnitiumClient } from "../client.js";
import { ToolEntry } from "../types.js";

export function blockingTools(client: TechnitiumClient): ToolEntry[] {
  return [
    {
      definition: {
        name: "dns_list_blocked",
        description: "List all blocked DNS zones (domains that are denied).",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      handler: async () => {
        const data = await client.callOrThrow("/api/blockedZones/list");
        return JSON.stringify(data, null, 2);
      },
    },
    {
      definition: {
        name: "dns_block_domain",
        description:
          "Block a domain name. Queries to this domain will be denied by the DNS server.",
        inputSchema: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              description: "Domain name to block (e.g. ads.example.com)",
            },
          },
          required: ["domain"],
        },
      },
      handler: async (args) => {
        const data = await client.callOrThrow("/api/blockedZones/add", {
          zone: args.domain as string,
        });
        return JSON.stringify(
          { success: true, blocked: args.domain, ...data },
          null,
          2
        );
      },
    },
    {
      definition: {
        name: "dns_list_allowed",
        description:
          "List all allowed DNS zones (domains that bypass block lists).",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      handler: async () => {
        const data = await client.callOrThrow("/api/allowedZones/list");
        return JSON.stringify(data, null, 2);
      },
    },
    {
      definition: {
        name: "dns_allow_domain",
        description:
          "Allow a domain name, bypassing any block lists. Useful for whitelisting false positives.",
        inputSchema: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              description: "Domain name to allow (e.g. plex.direct)",
            },
          },
          required: ["domain"],
        },
      },
      handler: async (args) => {
        const data = await client.callOrThrow("/api/allowedZones/add", {
          zone: args.domain as string,
        });
        return JSON.stringify(
          { success: true, allowed: args.domain, ...data },
          null,
          2
        );
      },
    },
  ];
}
