import { TechnitiumClient } from "../client.js";
import { ToolEntry } from "../types.js";
import {
  validateDomain,
  validateRecordType,
  validateIpOrHostname,
  validateProtocol,
} from "../validate.js";

export function dnsClientTools(client: TechnitiumClient): ToolEntry[] {
  return [
    {
      definition: {
        name: "dns_resolve",
        description:
          "Test DNS resolution for a domain name. Resolves using the Technitium server itself or a specified external server.",
        inputSchema: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              description: "Domain name to resolve (e.g. google.com)",
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
                "ANY",
              ],
              description: "DNS record type (default: A)",
            },
            server: {
              type: "string",
              description:
                "Optional DNS server to query (default: this server). Can be IP or DoH URL.",
            },
            protocol: {
              type: "string",
              enum: ["Udp", "Tcp", "Tls", "Https", "Quic"],
              description: "DNS protocol to use (default: Udp)",
            },
          },
          required: ["domain"],
        },
      },
      readonly: true,
      handler: async (args) => {
        const params: Record<string, string> = {
          domain: validateDomain(args.domain as string),
          type: args.type
            ? validateRecordType(args.type as string)
            : "A",
          server: args.server
            ? validateIpOrHostname(args.server as string)
            : "this-server",
        };
        if (args.protocol) {
          params.protocol = validateProtocol(args.protocol as string);
        }

        const data = await client.callOrThrow(
          "/api/dnsClient/resolve",
          params
        );
        return JSON.stringify(data, null, 2);
      },
    },
  ];
}
