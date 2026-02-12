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
      handler: async () => {
        const data = await client.callOrThrow("/api/settings/get");
        return JSON.stringify(data, null, 2);
      },
    },
  ];
}
