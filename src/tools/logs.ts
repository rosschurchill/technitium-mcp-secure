import { TechnitiumClient } from "../client.js";
import { ToolEntry } from "../types.js";
import {
  validateDateTime,
  validateIp,
  validateProtocol,
  validateRecordType,
  validateStringLength,
} from "../validate.js";

export function logTools(client: TechnitiumClient): ToolEntry[] {
  return [
    {
      definition: {
        name: "dns_query_logs",
        description:
          "Query DNS server logs with optional filters. Returns recent DNS queries and their responses. Requires the Query Logs app to be installed.",
        inputSchema: {
          type: "object",
          properties: {
            pageNumber: {
              type: "number",
              description: "Page number (default: 1)",
            },
            entriesPerPage: {
              type: "number",
              description: "Entries per page (default: 25, max: 100)",
            },
            descendingOrder: {
              type: "boolean",
              description: "Return results in descending order (default: true)",
            },
            start: {
              type: "string",
              description:
                "Start of time range in ISO 8601 format (e.g. 2024-01-15T10:30:00Z). Omit for no lower bound.",
            },
            end: {
              type: "string",
              description:
                "End of time range in ISO 8601 format (e.g. 2024-01-15T11:00:00Z). Omit for no upper bound.",
            },
            domain: {
              type: "string",
              description: "Filter by domain name (exact match, e.g. github.com)",
            },
            clientIp: {
              type: "string",
              description: "Filter by client IP address",
            },
            queryType: {
              type: "string",
              enum: ["A", "AAAA", "CNAME", "MX", "NS", "PTR", "SOA", "TXT", "ANY"],
              description: "Filter by DNS query type",
            },
            protocol: {
              type: "string",
              enum: ["Udp", "Tcp", "Tls", "Https", "Quic"],
              description: "Filter by DNS transport protocol",
            },
            responseType: {
              type: "string",
              enum: [
                "Authoritative",
                "Recursive",
                "Cached",
                "Blocked",
                "UpstreamBlocked",
                "CacheBlocked",
              ],
              description: "Filter by server response type",
            },
            responseCode: {
              type: "string",
              enum: [
                "NoError",
                "ServerFailure",
                "NxDomain",
                "Refused",
                "FormatError",
              ],
              description: "Filter by DNS response code",
            },
          },
        },
      },
      readonly: true,
      handler: async (args) => {
        const descendingOrder = args.descendingOrder !== false;
        const params: Record<string, string> = {
          name: "Query Logs (Sqlite)",
          classPath: "QueryLogsSqlite.App",
          pageNumber: String(args.pageNumber || 1),
          entriesPerPage: String(Math.min(Number(args.entriesPerPage) || 25, 100)),
          descendingOrder: String(descendingOrder),
        };

        if (args.start) {
          params.start = validateDateTime(args.start as string, "start");
        }
        if (args.end) {
          params.end = validateDateTime(args.end as string, "end");
        }
        if (args.domain) {
          params.qname = validateStringLength(args.domain as string, 253, "domain");
        }
        if (args.clientIp) {
          params.clientIpAddress = validateIp(args.clientIp as string);
        }
        if (args.queryType) {
          params.qtype = validateRecordType(args.queryType as string);
        }
        if (args.protocol) {
          params.protocol = validateProtocol(args.protocol as string);
        }
        if (args.responseType) {
          const validResponseTypes = new Set([
            "Authoritative", "Recursive", "Cached",
            "Blocked", "UpstreamBlocked", "CacheBlocked",
          ]);
          const rt = args.responseType as string;
          if (!validResponseTypes.has(rt)) {
            throw new Error(`Invalid responseType: ${rt}`);
          }
          params.responseType = rt;
        }
        if (args.responseCode) {
          const validRcodes = new Set([
            "NoError", "ServerFailure", "NxDomain", "Refused", "FormatError",
          ]);
          const code = args.responseCode as string;
          if (!validRcodes.has(code)) {
            throw new Error(`Invalid response code: ${code}`);
          }
          params.rcode = code;
        }

        const data = await client.callOrThrow("/api/logs/query", params);
        return JSON.stringify(data, null, 2);
      },
    },
  ];
}
