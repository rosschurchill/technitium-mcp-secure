import { TechnitiumClient } from "../client.js";
import { ToolEntry } from "../types.js";
import { dashboardTools } from "./dashboard.js";
import { dnsClientTools } from "./dns-client.js";
import { zoneTools } from "./zones.js";
import { recordTools } from "./records.js";
import { blockingTools } from "./blocking.js";
import { cacheTools } from "./cache.js";
import { settingsTools } from "./settings.js";
import { logTools } from "./logs.js";
import { appTools } from "./apps.js";
import { dnssecTools } from "./dnssec.js";

export function getAllTools(client: TechnitiumClient): ToolEntry[] {
  return [
    ...dashboardTools(client),
    ...dnsClientTools(client),
    ...zoneTools(client),
    ...recordTools(client),
    ...blockingTools(client),
    ...cacheTools(client),
    ...settingsTools(client),
    ...logTools(client),
    ...appTools(client),
    ...dnssecTools(client),
  ];
}
