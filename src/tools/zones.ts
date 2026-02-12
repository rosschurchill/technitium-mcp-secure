import { TechnitiumClient } from "../client.js";
import { ToolEntry } from "../types.js";
import { validateDomain, validateZoneType } from "../validate.js";

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
      readonly: true,
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
      readonly: false,
      handler: async (args) => {
        const zone = validateDomain(args.zone as string);
        const type = args.type
          ? validateZoneType(args.type as string)
          : "Primary";
        const data = await client.callOrThrow("/api/zones/create", {
          zone,
          type,
        });
        return JSON.stringify(data, null, 2);
      },
    },
    {
      definition: {
        name: "dns_delete_zone",
        description:
          "Delete a DNS zone and all its records. Requires confirm=true to execute.",
        inputSchema: {
          type: "object",
          properties: {
            zone: {
              type: "string",
              description: "Zone domain name to delete",
            },
            confirm: {
              type: "boolean",
              description:
                "Must be true to confirm deletion. Without this, returns a warning instead of deleting.",
            },
          },
          required: ["zone"],
        },
      },
      readonly: false,
      handler: async (args) => {
        const zone = validateDomain(args.zone as string);
        if (args.confirm !== true) {
          return JSON.stringify(
            {
              warning: `This will permanently delete zone '${zone}' and ALL its records. Set confirm=true to proceed.`,
            },
            null,
            2
          );
        }
        const data = await client.callOrThrow("/api/zones/delete", { zone });
        return JSON.stringify(
          { success: true, deleted: zone, ...data },
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
      readonly: true,
      handler: async (args) => {
        const zone = validateDomain(args.zone as string);
        const data = await client.callOrThrow("/api/zones/options/get", {
          zone,
        });
        return JSON.stringify(data, null, 2);
      },
    },
  ];
}
