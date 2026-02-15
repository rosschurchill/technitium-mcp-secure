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
    {
      definition: {
        name: "dns_remove_allowed",
        description:
          "Remove a domain from the allow list. The domain will no longer bypass block lists.",
        inputSchema: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              description: "Domain name to remove from allow list",
            },
          },
          required: ["domain"],
        },
      },
      readonly: false,
      handler: async (args) => {
        const domain = validateDomain(args.domain as string);
        const data = await client.callOrThrow("/api/allowed/delete", {
          domain,
        });
        return JSON.stringify(
          { success: true, removed: domain, ...data },
          null,
          2
        );
      },
    },
    {
      definition: {
        name: "dns_remove_blocked",
        description:
          "Remove a domain from the block list. The domain will no longer be denied.",
        inputSchema: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              description: "Domain name to remove from block list",
            },
          },
          required: ["domain"],
        },
      },
      readonly: false,
      handler: async (args) => {
        const domain = validateDomain(args.domain as string);
        const data = await client.callOrThrow("/api/blocked/delete", {
          domain,
        });
        return JSON.stringify(
          { success: true, removed: domain, ...data },
          null,
          2
        );
      },
    },
    {
      definition: {
        name: "dns_flush_allowed",
        description:
          "Flush the entire allow list. All allowed domains will be removed. Requires confirm=true to execute.",
        inputSchema: {
          type: "object",
          properties: {
            confirm: {
              type: "boolean",
              description:
                "Must be true to confirm flush. Without this, returns a warning instead.",
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
                "This will remove ALL domains from the allow list. Set confirm=true to proceed.",
            },
            null,
            2
          );
        }
        const data = await client.callOrThrow("/api/allowed/flush");
        return JSON.stringify(
          { success: true, message: "Allow list flushed", ...data },
          null,
          2
        );
      },
    },
    {
      definition: {
        name: "dns_flush_blocked",
        description:
          "Flush the entire custom block list. All manually blocked domains will be removed. Requires confirm=true to execute.",
        inputSchema: {
          type: "object",
          properties: {
            confirm: {
              type: "boolean",
              description:
                "Must be true to confirm flush. Without this, returns a warning instead.",
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
                "This will remove ALL domains from the custom block list. Set confirm=true to proceed.",
            },
            null,
            2
          );
        }
        const data = await client.callOrThrow("/api/blocked/flush");
        return JSON.stringify(
          { success: true, message: "Block list flushed", ...data },
          null,
          2
        );
      },
    },
  ];
}
