import { TechnitiumClient } from "../client.js";
import { ToolEntry } from "../types.js";
import { validatePeriod } from "../validate.js";

export function dashboardTools(client: TechnitiumClient): ToolEntry[] {
  return [
    {
      definition: {
        name: "dns_get_stats",
        description:
          "Get DNS query statistics for a time period. Returns total queries, cached, blocked, failure counts, plus top clients, top domains, and top blocked domains.",
        inputSchema: {
          type: "object",
          properties: {
            period: {
              type: "string",
              enum: [
                "LastHour",
                "LastDay",
                "LastWeek",
                "LastMonth",
                "LastYear",
              ],
              description: "Time period for stats (default: LastDay)",
            },
          },
        },
      },
      readonly: true,
      handler: async (args) => {
        const period = args.period
          ? validatePeriod(args.period as string)
          : "LastDay";
        const data = await client.callOrThrow("/api/dashboard/stats/get", {
          type: period,
        });
        const stats = data.stats as Record<string, unknown>;
        const topClients = data.topClients as unknown[];
        const topDomains = data.topDomains as unknown[];
        const topBlocked = data.topBlockedDomains as unknown[];

        return JSON.stringify(
          { stats, topClients, topDomains, topBlockedDomains: topBlocked },
          null,
          2
        );
      },
    },
    {
      definition: {
        name: "dns_health_check",
        description:
          "Quick health check of the DNS server. Returns version, uptime, forwarder config, blocking status, and last hour failure rate.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      readonly: true,
      handler: async () => {
        const [settings, stats] = await Promise.all([
          client.callOrThrow("/api/settings/get"),
          client.callOrThrow("/api/dashboard/stats/get", {
            type: "LastHour",
          }),
        ]);

        const s = stats.stats as Record<string, number>;
        const totalQueries = s.totalQueries || 0;
        const failures = s.totalServerFailure || 0;
        const failureRate =
          totalQueries > 0
            ? ((failures / totalQueries) * 100).toFixed(1)
            : "0.0";

        return JSON.stringify(
          {
            version: settings.version,
            uptimestamp: settings.uptimestamp,
            dnsServerDomain: settings.dnsServerDomain,
            forwarders: settings.forwarders,
            forwarderProtocol: settings.forwarderProtocol,
            enableBlocking: settings.enableBlocking,
            lastHour: {
              totalQueries,
              serverFailures: failures,
              failureRate: `${failureRate}%`,
              blocked: s.totalBlocked || 0,
              cached: s.totalCached || 0,
            },
          },
          null,
          2
        );
      },
    },
  ];
}
