import { TechnitiumClient } from "../client.js";
import { ToolEntry } from "../types.js";

export function zoneTools(client: TechnitiumClient): ToolEntry[] {
  return [
    {
      definition: {
        name: "dns_list_zones",
        description:
          "List all DNS zones configured on the server. Returns zone name, type (Primary/Secondary/Stub/Forwarder), status, and record count.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      handler: async () => {
        const data = await client.callOrThrow("/api/zones/list");
        return JSON.stringify(data, null, 2);
      },
    },
    {
      definition: {
        name: "dns_create_zone",
        description:
          "Create a new DNS zone. Use 'Primary' for hosting records locally, 'Forwarder' for conditional forwarding.",
        inputSchema: {
          type: "object",
          properties: {
            zone: {
              type: "string",
              description: "Zone domain name (e.g. example.com)",
            },
            type: {
              type: "string",
              enum: ["Primary", "Secondary", "Stub", "Forwarder"],
              description: "Zone type (default: Primary)",
            },
          },
          required: ["zone"],
        },
      },
      handler: async (args) => {
        const data = await client.callOrThrow("/api/zones/create", {
          zone: args.zone as string,
          type: (args.type as string) || "Primary",
        });
        return JSON.stringify(data, null, 2);
      },
    },
    {
      definition: {
        name: "dns_delete_zone",
        description: "Delete a DNS zone and all its records.",
        inputSchema: {
          type: "object",
          properties: {
            zone: {
              type: "string",
              description: "Zone domain name to delete",
            },
          },
          required: ["zone"],
        },
      },
      handler: async (args) => {
        const data = await client.callOrThrow("/api/zones/delete", {
          zone: args.zone as string,
        });
        return JSON.stringify(
          { success: true, deleted: args.zone, ...data },
          null,
          2
        );
      },
    },
    {
      definition: {
        name: "dns_zone_options",
        description:
          "Get the configuration options for a specific zone including DNSSEC, transfer, and notify settings.",
        inputSchema: {
          type: "object",
          properties: {
            zone: {
              type: "string",
              description: "Zone domain name",
            },
          },
          required: ["zone"],
        },
      },
      handler: async (args) => {
        const data = await client.callOrThrow("/api/zones/options/get", {
          zone: args.zone as string,
        });
        return JSON.stringify(data, null, 2);
      },
    },
  ];
}
