import { TechnitiumClient } from "../client.js";
import { ToolEntry } from "../types.js";
import { validateDomain } from "../validate.js";

export function dnssecTools(client: TechnitiumClient): ToolEntry[] {
  return [
    {
      definition: {
        name: "dns_dnssec_info",
        description:
          "Get DNSSEC properties for a zone including signing status, key details, and algorithm info.",
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
        const data = await client.callOrThrow(
          "/api/zones/dnssec/properties/get",
          { zone }
        );
        return JSON.stringify(data, null, 2);
      },
    },
    {
      definition: {
        name: "dns_get_ds",
        description:
          "Get the DS (Delegation Signer) records for a DNSSEC-signed zone. These are needed by the parent zone registrar.",
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
        const data = await client.callOrThrow("/api/zones/dnssec/viewDS", {
          zone,
        });
        return JSON.stringify(data, null, 2);
      },
    },
  ];
}
