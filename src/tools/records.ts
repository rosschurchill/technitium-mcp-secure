import { TechnitiumClient } from "../client.js";
import { ToolEntry } from "../types.js";
import { validateDomain, validateRecordType, validateIp } from "../validate.js";

/** Parse a BIND-format zone export into structured records */
function parseBind(
  zone: string,
  bindText: string
): Array<{ name: string; ttl: number; type: string; value: string }> {
  const records: Array<{ name: string; ttl: number; type: string; value: string }> = [];
  const origin = zone.endsWith(".") ? zone : zone + ".";

  for (const raw of bindText.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith(";") || line.startsWith("$")) continue;

    // Format: <name> <ttl> IN <type> <rdata...>
    const parts = line.split(/\s+/);
    if (parts.length < 5) continue;
    const [name, ttlStr, , type, ...rdata] = parts;
    const ttl = parseInt(ttlStr, 10);
    if (isNaN(ttl)) continue;

    const fqdn =
      name === "@" ? zone : name.includes(".") ? name.replace(/\.$/, "") : `${name}.${zone}`;

    records.push({ name: fqdn, ttl, type, value: rdata.join(" ") });
  }

  return records;
}

export function recordTools(client: TechnitiumClient): ToolEntry[] {
  return [
    {
      definition: {
        name: "dns_list_records",
        description:
          "List DNS records in a zone. Optionally filter by a specific domain name within the zone. " +
          "When no domain is specified, returns all records across all zones matching the zone name " +
          "(including subzones like grafana.theshellnet.com when zone=theshellnet.com). " +
          "When domain is specified, returns records for that exact domain only.",
        inputSchema: {
          type: "object",
          properties: {
            zone: {
              type: "string",
              description:
                "Zone domain name (e.g. theshellnet.com). Can be a parent domain to list all subzones.",
            },
            domain: {
              type: "string",
              description:
                "Optional specific domain to filter (e.g. www.theshellnet.com). Defaults to the zone name if omitted.",
            },
          },
          required: ["zone"],
        },
      },
      readonly: true,
      handler: async (args) => {
        const zone = validateDomain(args.zone as string);

        if (args.domain) {
          // Specific domain requested — query that domain directly
          const domain = validateDomain(args.domain as string);
          const data = await client.callOrThrow("/api/zones/records/get", {
            zone,
            domain,
          });
          return JSON.stringify(data, null, 2);
        }

        // No domain specified — find all zones that match or are subzones of the requested name
        const zoneList = await client.callOrThrow("/api/zones/list");
        const allZones = (
          zoneList.zones as Array<{ name: string; internal: boolean }>
        ).filter(
          (z) =>
            !z.internal &&
            (z.name === zone || z.name.endsWith("." + zone))
        );

        if (allZones.length === 0) {
          // No matching zones — fall back to direct query (will surface API error if zone missing)
          const data = await client.callOrThrow("/api/zones/records/get", {
            zone,
            domain: zone,
          });
          return JSON.stringify(data, null, 2);
        }

        if (allZones.length === 1 && allZones[0].name === zone) {
          // Exact single zone — export to get ALL records (apex + subdomains)
          const bindText = await client.callRawTextGet("/api/zones/export", {
            zone,
          });
          return JSON.stringify(
            { zone, records: parseBind(zone, bindText) },
            null,
            2
          );
        }

        // Multiple zones or parent-level query — export each and combine
        const results: unknown[] = [];
        for (const z of allZones) {
          try {
            const bindText = await client.callRawTextGet("/api/zones/export", {
              zone: z.name,
            });
            results.push({ zone: z.name, records: parseBind(z.name, bindText) });
          } catch (e) {
            results.push({ zone: z.name, error: String(e) });
          }
        }
        return JSON.stringify(
          { totalZones: results.length, zones: results },
          null,
          2
        );
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
