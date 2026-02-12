import { TechnitiumClient } from "../client.js";
import { ToolEntry } from "../types.js";
import { validateDomain, validateRecordType, validateIp } from "../validate.js";

export function recordTools(client: TechnitiumClient): ToolEntry[] {
  return [
    {
      definition: {
        name: "dns_list_records",
        description:
          "List DNS records in a zone. Optionally filter by a specific domain name within the zone.",
        inputSchema: {
          type: "object",
          properties: {
            zone: {
              type: "string",
              description: "Zone domain name (e.g. theshellnet.com)",
            },
            domain: {
              type: "string",
              description:
                "Optional specific domain to filter (e.g. www.theshellnet.com)",
            },
          },
          required: ["zone"],
        },
      },
      readonly: true,
      handler: async (args) => {
        const params: Record<string, string> = {
          zone: validateDomain(args.zone as string),
        };
        if (args.domain) params.domain = validateDomain(args.domain as string);

        const data = await client.callOrThrow(
          "/api/zones/records/get",
          params
        );
        return JSON.stringify(data, null, 2);
      },
    },
    {
      definition: {
        name: "dns_add_record",
        description:
          "Add a DNS record to a zone. Creates the zone automatically if it doesn't exist for Primary type.",
        inputSchema: {
          type: "object",
          properties: {
            zone: {
              type: "string",
              description: "Zone domain name",
            },
            domain: {
              type: "string",
              description: "Full domain name for the record",
            },
            type: {
              type: "string",
              enum: [
                "A",
                "AAAA",
                "CNAME",
                "MX",
                "NS",
                "PTR",
                "SOA",
                "SRV",
                "TXT",
                "CAA",
              ],
              description: "Record type",
            },
            value: {
              type: "string",
              description:
                "Record value (IP for A/AAAA, hostname for CNAME/MX/NS, text for TXT)",
            },
            ttl: {
              type: "number",
              description: "TTL in seconds (default: 3600)",
            },
            overwrite: {
              type: "boolean",
              description:
                "Overwrite existing records of the same type (default: false)",
            },
            priority: {
              type: "number",
              description: "Priority for MX records",
            },
          },
          required: ["zone", "domain", "type", "value"],
        },
      },
      readonly: false,
      handler: async (args) => {
        const zone = validateDomain(args.zone as string);
        const domain = validateDomain(args.domain as string);
        const recType = validateRecordType(args.type as string);
        const value = args.value as string;

        const params: Record<string, string> = {
          zone,
          domain,
          type: recType,
          overwrite: args.overwrite ? "true" : "false",
        };

        if (args.ttl) params.ttl = String(args.ttl);

        if (recType === "A" || recType === "AAAA") {
          params.ipAddress = validateIp(value);
        } else if (recType === "CNAME") {
          params.cname = validateDomain(value);
        } else if (recType === "NS") {
          params.nameServer = validateDomain(value);
        } else if (recType === "PTR") {
          params.ptrName = validateDomain(value);
        } else if (recType === "MX") {
          params.exchange = validateDomain(value);
          if (args.priority) params.preference = String(args.priority);
        } else if (recType === "TXT") {
          params.text = value;
        } else if (recType === "SRV") {
          params.target = value;
          if (args.priority) params.priority = String(args.priority);
        } else if (recType === "CAA") {
          params.value = value;
        }

        const data = await client.callOrThrow(
          "/api/zones/records/add",
          params
        );
        return JSON.stringify(data, null, 2);
      },
    },
    {
      definition: {
        name: "dns_update_record",
        description: "Update an existing DNS record.",
        inputSchema: {
          type: "object",
          properties: {
            zone: { type: "string", description: "Zone domain name" },
            domain: { type: "string", description: "Current domain name" },
            type: {
              type: "string",
              enum: ["A", "AAAA", "CNAME", "MX", "NS", "PTR", "TXT"],
              description: "Record type",
            },
            value: { type: "string", description: "Current record value" },
            newValue: { type: "string", description: "New record value" },
            newDomain: {
              type: "string",
              description: "New domain name (to rename)",
            },
            ttl: { type: "number", description: "New TTL in seconds" },
          },
          required: ["zone", "domain", "type", "value", "newValue"],
        },
      },
      readonly: false,
      handler: async (args) => {
        const zone = validateDomain(args.zone as string);
        const domain = validateDomain(args.domain as string);
        const recType = validateRecordType(args.type as string);

        const params: Record<string, string> = {
          zone,
          domain,
          type: recType,
        };

        if (args.newDomain)
          params.newDomain = validateDomain(args.newDomain as string);
        if (args.ttl) params.ttl = String(args.ttl);

        const value = args.value as string;
        const newValue = args.newValue as string;

        if (recType === "A" || recType === "AAAA") {
          params.ipAddress = validateIp(value);
          params.newIpAddress = validateIp(newValue);
        } else if (recType === "CNAME") {
          params.cname = validateDomain(value);
          params.newCname = validateDomain(newValue);
        } else if (recType === "MX") {
          params.exchange = validateDomain(value);
          params.newExchange = validateDomain(newValue);
        } else if (recType === "TXT") {
          params.text = value;
          params.newText = newValue;
        }

        const data = await client.callOrThrow(
          "/api/zones/records/update",
          params
        );
        return JSON.stringify(data, null, 2);
      },
    },
    {
      definition: {
        name: "dns_delete_record",
        description:
          "Delete a specific DNS record from a zone. Requires confirm=true to execute.",
        inputSchema: {
          type: "object",
          properties: {
            zone: { type: "string", description: "Zone domain name" },
            domain: {
              type: "string",
              description: "Domain name of the record",
            },
            type: {
              type: "string",
              enum: [
                "A",
                "AAAA",
                "CNAME",
                "MX",
                "NS",
                "PTR",
                "TXT",
                "SRV",
                "CAA",
              ],
              description: "Record type",
            },
            value: {
              type: "string",
              description: "Record value to delete (IP for A/AAAA, etc)",
            },
            confirm: {
              type: "boolean",
              description:
                "Must be true to confirm deletion. Without this, returns a warning instead of deleting.",
            },
          },
          required: ["zone", "domain", "type", "value"],
        },
      },
      readonly: false,
      handler: async (args) => {
        const zone = validateDomain(args.zone as string);
        const domain = validateDomain(args.domain as string);
        const recType = validateRecordType(args.type as string);
        const value = args.value as string;

        if (args.confirm !== true) {
          return JSON.stringify(
            {
              warning: `This will delete the ${recType} record for '${domain}' (value: ${value}). Set confirm=true to proceed.`,
            },
            null,
            2
          );
        }

        const params: Record<string, string> = {
          zone,
          domain,
          type: recType,
        };

        if (recType === "A" || recType === "AAAA") {
          params.ipAddress = validateIp(value);
        } else if (recType === "CNAME") {
          params.cname = value;
        } else if (recType === "MX") {
          params.exchange = value;
        } else if (recType === "TXT") {
          params.text = value;
        } else if (recType === "NS") {
          params.nameServer = value;
        }

        const data = await client.callOrThrow(
          "/api/zones/records/delete",
          params
        );
        return JSON.stringify(
          {
            success: true,
            deleted: `${recType} ${domain} -> ${value}`,
            ...data,
          },
          null,
          2
        );
      },
    },
  ];
}
