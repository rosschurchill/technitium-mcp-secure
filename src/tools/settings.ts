import { TechnitiumClient } from "../client.js";
import { ToolEntry } from "../types.js";

export function settingsTools(client: TechnitiumClient): ToolEntry[] {
  return [
    {
      definition: {
        name: "dns_get_settings",
        description:
          "Get the current DNS server settings including forwarders, blocking configuration, protocols, logging, cache settings, and proxy configuration.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      readonly: true,
      handler: async () => {
        const data = await client.callOrThrow("/api/settings/get");
        return JSON.stringify(data, null, 2);
      },
    },
    {
      definition: {
        name: "dns_set_settings",
        description:
          "Update DNS server settings. Pass key/value pairs for any settings to change (e.g. forwarders, blocking, recursion, cache). Use dns_get_settings first to see current values and available keys.",
        inputSchema: {
          type: "object",
          properties: {
            enableBlocking: {
              type: "boolean",
              description: "Enable or disable domain blocking",
            },
            forwarders: {
              type: "string",
              description:
                "Comma-separated list of forwarder addresses (IP, hostname, or DoH URL)",
            },
            forwarderProtocol: {
              type: "string",
              enum: ["Udp", "Tcp", "Tls", "Https", "Quic"],
              description: "Protocol for upstream forwarders",
            },
            dnssecValidation: {
              type: "boolean",
              description: "Enable or disable DNSSEC validation",
            },
            preferIPv6: {
              type: "boolean",
              description: "Prefer IPv6 for DNS resolution",
            },
            logQueries: {
              type: "boolean",
              description: "Enable or disable query logging",
            },
            blockListUrls: {
              type: "string",
              description:
                "Comma-separated list of block list URLs to use for domain blocking",
            },
          },
        },
      },
      readonly: false,
      handler: async (args) => {
        const params: Record<string, string> = {};
        for (const [key, value] of Object.entries(args)) {
          if (value !== undefined) {
            params[key] = String(value);
          }
        }
        if (Object.keys(params).length === 0) {
          return JSON.stringify(
            { error: "No settings provided. Use dns_get_settings to see available keys." },
            null,
            2
          );
        }
        const data = await client.callOrThrow("/api/settings/set", params);
        return JSON.stringify(
          { success: true, message: "Settings updated", ...data },
          null,
          2
        );
      },
    },
    {
      definition: {
        name: "dns_update_blocklists",
        description:
          "Force an immediate update of all configured block lists. Normally block lists update every 24 hours.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      readonly: false,
      handler: async () => {
        const data = await client.callOrThrow(
          "/api/settings/forceUpdateBlockLists"
        );
        return JSON.stringify(
          { success: true, message: "Block list update triggered", ...data },
          null,
          2
        );
      },
    },
    {
      definition: {
        name: "dns_temp_disable_blocking",
        description:
          "Temporarily disable domain blocking for a specified number of minutes. Blocking re-enables automatically after the timer expires.",
        inputSchema: {
          type: "object",
          properties: {
            minutes: {
              type: "number",
              description:
                "Number of minutes to disable blocking (default: 5)",
            },
          },
        },
      },
      readonly: false,
      handler: async (args) => {
        const minutes =
          typeof args.minutes === "number" && args.minutes > 0
            ? args.minutes
            : 5;
        const data = await client.callOrThrow(
          "/api/settings/temporaryDisableBlocking",
          { minutes: String(minutes) }
        );
        return JSON.stringify(
          {
            success: true,
            message: `Blocking disabled for ${minutes} minutes`,
            ...data,
          },
          null,
          2
        );
      },
    },
  ];
}
