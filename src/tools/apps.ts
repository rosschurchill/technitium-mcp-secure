import { TechnitiumClient } from "../client.js";
import { ToolEntry } from "../types.js";

export function appTools(client: TechnitiumClient): ToolEntry[] {
  return [
    {
      definition: {
        name: "dns_list_apps",
        description:
          "List installed DNS apps on the server and their current status.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      handler: async () => {
        const data = await client.callOrThrow("/api/apps/list");
        return JSON.stringify(data, null, 2);
      },
    },
  ];
}
