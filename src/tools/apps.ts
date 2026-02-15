import { TechnitiumClient } from "../client.js";
import { ToolEntry } from "../types.js";
import { validateStringLength } from "../validate.js";

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
      readonly: true,
      handler: async () => {
        const data = await client.callOrThrow("/api/apps/list");
        return JSON.stringify(data, null, 2);
      },
    },
    {
      definition: {
        name: "dns_list_app_store",
        description:
          "List all available apps from the Technitium DNS app store with versions and descriptions.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      readonly: true,
      handler: async () => {
        const data = await client.callOrThrow("/api/apps/listStoreApps");
        return JSON.stringify(data, null, 2);
      },
    },
    {
      definition: {
        name: "dns_install_app",
        description:
          "Download and install a DNS app from the Technitium app store. Use dns_list_app_store to see available apps.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description:
                "App name exactly as shown in the app store (e.g. 'Query Logs (Sqlite)')",
            },
          },
          required: ["name"],
        },
      },
      readonly: false,
      handler: async (args) => {
        const name = validateStringLength(args.name as string, 200, "App name");
        const data = await client.callOrThrow(
          "/api/apps/downloadAndInstall",
          { name }
        );
        return JSON.stringify(
          { success: true, installed: name, ...data },
          null,
          2
        );
      },
    },
    {
      definition: {
        name: "dns_uninstall_app",
        description:
          "Uninstall a DNS app from the server. Requires confirm=true to execute.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the app to uninstall",
            },
            confirm: {
              type: "boolean",
              description:
                "Must be true to confirm uninstall. Without this, returns a warning instead.",
            },
          },
          required: ["name"],
        },
      },
      readonly: false,
      handler: async (args) => {
        const name = validateStringLength(args.name as string, 200, "App name");
        if (args.confirm !== true) {
          return JSON.stringify(
            {
              warning: `This will uninstall the app '${name}' and remove its data. Set confirm=true to proceed.`,
            },
            null,
            2
          );
        }
        const data = await client.callOrThrow("/api/apps/uninstall", { name });
        return JSON.stringify(
          { success: true, uninstalled: name, ...data },
          null,
          2
        );
      },
    },
    {
      definition: {
        name: "dns_get_app_config",
        description:
          "Get the configuration for an installed DNS app.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the installed app",
            },
          },
          required: ["name"],
        },
      },
      readonly: true,
      handler: async (args) => {
        const name = validateStringLength(args.name as string, 200, "App name");
        const data = await client.callOrThrow("/api/apps/config/get", { name });
        return JSON.stringify(data, null, 2);
      },
    },
  ];
}
