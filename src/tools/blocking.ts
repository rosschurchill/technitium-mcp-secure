import { TechnitiumClient } from "../client.js";
import { ToolEntry } from "../types.js";
import { validateDomain } from "../validate.js";

export function blockingTools(client: TechnitiumClient): ToolEntry[] {
  return [
    {
      definition: {
        name: "dns_list_blocked",
        description:
          "List blocked DNS zones (domains that are denied). Returns a hierarchical tree — call with no domain to see top-level zones, then pass a domain (e.g. 'com') to drill into subdomains.",
        inputSchema: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              description:
                "Optional parent domain to list children of (e.g. 'com' to see all blocked .com domains). Omit to see top-level zones.",
            },
          },
        },
      },
      readonly: true,
      handler: async (args) => {
        const params: Record<string, string> = {};
        if (args.domain) params.domain = validateDomain(args.domain as string);
        const data = await client.callOrThrow("/api/blocked/list", params);
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
      readonly: false,
      handler: async (args) => {
        const domain = validateDomain(args.domain as string);
        const data = await client.callOrThrow("/api/blocked/add", {
          domain,
        });
        return JSON.stringify(
          { success: true, blocked: domain, ...data },
          null,
          2
        );
      },
    },
    {
      definition: {
        name: "dns_list_allowed",
        description:
          "List allowed DNS zones (domains that bypass block lists). Returns a hierarchical tree — call with no domain to see top-level zones, then pass a domain (e.g. 'com') to drill into subdomains.",
        inputSchema: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              description:
                "Optional parent domain to list children of (e.g. 'com' to see all allowed .com domains). Omit to see top-level zones.",
            },
          },
        },
      },
      readonly: true,
      handler: async (args) => {
        const params: Record<string, string> = {};
        if (args.domain) params.domain = validateDomain(args.domain as string);
        const data = await client.callOrThrow("/api/allowed/list", params);
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
      readonly: false,
      handler: async (args) => {
        const domain = validateDomain(args.domain as string);
        const data = await client.callOrThrow("/api/allowed/add", {
          domain,
        });
        return JSON.stringify(
          { success: true, allowed: domain, ...data },
          null,
          2
        );
      },
    },
  ];
}
