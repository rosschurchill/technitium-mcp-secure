import { TechnitiumClient } from "../client.js";
import { ToolEntry } from "../types.js";
import {
  validateIp,
  validateMacAddress,
  validateStringLength,
} from "../validate.js";

interface ReservedLease {
  hardwareAddress?: string;
  address?: string;
  hostName?: string;
  comments?: string;
  [key: string]: unknown;
}

interface Lease {
  scope?: string;
  type?: string;
  hardwareAddress?: string;
  clientIdentifier?: string;
  address?: string;
  hostName?: string;
  leaseObtained?: string;
  leaseExpires?: string;
  [key: string]: unknown;
}

function normalizeMacForCompare(mac: string): string {
  return mac.replace(/[:-]/g, "").toUpperCase();
}

async function findReservation(
  client: TechnitiumClient,
  scopeName: string,
  hardwareAddress: string
): Promise<ReservedLease | null> {
  const data = await client.callOrThrow("/api/dhcp/scopes/get", {
    name: scopeName,
  });
  const reserved = (data.reservedLeases as ReservedLease[]) ?? [];
  const target = normalizeMacForCompare(hardwareAddress);
  for (const r of reserved) {
    if (r.hardwareAddress && normalizeMacForCompare(r.hardwareAddress) === target) {
      return r;
    }
  }
  return null;
}

export function dhcpTools(client: TechnitiumClient): ToolEntry[] {
  return [
    // -----------------------------------------------------------------------
    // Scope tools
    // -----------------------------------------------------------------------
    {
      definition: {
        name: "dhcp_list_scopes",
        description:
          "List all DHCP scopes. Returns a lightweight summary (name, enabled, address range, subnet). Use dhcp_get_scope for full details.",
        inputSchema: { type: "object", properties: {} },
      },
      readonly: true,
      handler: async () => {
        const data = await client.callOrThrow("/api/dhcp/scopes/list");
        return JSON.stringify(data, null, 2);
      },
    },
    {
      definition: {
        name: "dhcp_get_scope",
        description:
          "Get full configuration for a DHCP scope, including lease times, DNS options, exclusions, and reservedLeases[].",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Scope name (e.g. \"pape.house LAN\")" },
          },
          required: ["name"],
        },
      },
      readonly: true,
      handler: async (args) => {
        const name = validateStringLength(args.name as string, 256, "name");
        const data = await client.callOrThrow("/api/dhcp/scopes/get", { name });
        return JSON.stringify(data, null, 2);
      },
    },
    {
      definition: {
        name: "dhcp_create_scope",
        description:
          "Create a new DHCP scope. Fails if a scope with the same name already exists — use dhcp_update_scope to modify an existing one. The scope is created disabled by default; call dhcp_set_scope_enabled to start serving leases.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Scope name (unique)" },
            startingAddress: { type: "string", description: "First IP in the pool" },
            endingAddress: { type: "string", description: "Last IP in the pool" },
            subnetMask: { type: "string", description: "Subnet mask, e.g. 255.255.255.0" },
            leaseTimeDays: { type: "number", description: "Optional lease duration (days component)" },
            leaseTimeHours: { type: "number", description: "Optional lease duration (hours component)" },
            leaseTimeMinutes: { type: "number", description: "Optional lease duration (minutes component)" },
            domainName: { type: "string", description: "Optional DHCP option 15 (domain name)" },
            routerAddress: { type: "string", description: "Optional default gateway" },
            useThisDnsServer: { type: "boolean", description: "If true, advertise this DNS server to clients" },
            dnsServers: { type: "string", description: "Optional pipe-delimited list of DNS server IPs" },
          },
          required: ["name", "startingAddress", "endingAddress", "subnetMask"],
        },
      },
      readonly: false,
      handler: async (args) => {
        const name = validateStringLength(args.name as string, 256, "name");
        const startingAddress = validateIp(args.startingAddress as string);
        const endingAddress = validateIp(args.endingAddress as string);
        const subnetMask = validateIp(args.subnetMask as string);

        // Technitium's scopes/set is one endpoint for both create and update —
        // pre-check is the only way to give create-vs-update tools distinct
        // semantics. Accepts a small TOCTOU window in exchange for surprising
        // a caller less than a silent overwrite.
        const existing = await client.callOrThrow("/api/dhcp/scopes/list");
        const scopes = (existing.scopes as Array<{ name: string }>) ?? [];
        if (scopes.some((s) => s.name === name)) {
          throw new Error(
            `DHCP scope '${name}' already exists. Use dhcp_update_scope to modify it.`
          );
        }

        const params: Record<string, string> = {
          name,
          startingAddress,
          endingAddress,
          subnetMask,
        };
        const passthrough = [
          "leaseTimeDays",
          "leaseTimeHours",
          "leaseTimeMinutes",
          "domainName",
          "routerAddress",
          "useThisDnsServer",
          "dnsServers",
        ];
        for (const k of passthrough) {
          if (args[k] !== undefined) params[k] = String(args[k]);
        }
        if (params.routerAddress) validateIp(params.routerAddress);

        const data = await client.callOrThrow("/api/dhcp/scopes/set", params);
        return JSON.stringify({ success: true, created: name, ...data }, null, 2);
      },
    },
    {
      definition: {
        name: "dhcp_update_scope",
        description:
          "Update an existing DHCP scope. Pass `name` plus any subset of fields to change. To rename, pass `newName`. " +
          "WARNING: list-valued fields (dnsServers, staticRoutes, exclusions, reservedLeases, etc.) are passed through to Technitium's scopes/set and OVERWRITE the existing list. " +
          "To append to a list field, first call dhcp_get_scope, build the full pipe-delimited string, then pass it here. " +
          "Use the dedicated reservation tools (dhcp_create_reservation, dhcp_delete_reservation) for individual reservations.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Current scope name" },
            newName: { type: "string", description: "Optional rename target" },
            startingAddress: { type: "string", description: "Pool start IP" },
            endingAddress: { type: "string", description: "Pool end IP" },
            subnetMask: { type: "string", description: "Subnet mask" },
            leaseTimeDays: { type: "number", description: "Lease duration (days)" },
            leaseTimeHours: { type: "number", description: "Lease duration (hours)" },
            leaseTimeMinutes: { type: "number", description: "Lease duration (minutes)" },
            domainName: { type: "string", description: "DHCP option 15" },
            domainSearchList: { type: "string", description: "Pipe-delimited domain search list" },
            routerAddress: { type: "string", description: "Default gateway" },
            useThisDnsServer: { type: "boolean", description: "Advertise this DNS server to clients" },
            dnsServers: { type: "string", description: "Pipe-delimited list of DNS server IPs (overwrites)" },
            ntpServers: { type: "string", description: "Pipe-delimited list of NTP server IPs (overwrites)" },
            staticRoutes: { type: "string", description: "Static routes (overwrites)" },
            exclusions: { type: "string", description: "Pipe-delimited exclusions (overwrites)" },
            allowOnlyReservedLeases: { type: "boolean", description: "If true, dynamic-pool clients are not served" },
            blockLocallyAdministeredMacAddresses: { type: "boolean", description: "Reject MACs with the LAA bit set" },
          },
          required: ["name"],
        },
      },
      readonly: false,
      handler: async (args) => {
        const name = validateStringLength(args.name as string, 256, "name");

        // See dhcp_create_scope — same endpoint for both ops, so pre-check
        // distinguishes "update missing scope" from "silent create".
        const existing = await client.callOrThrow("/api/dhcp/scopes/list");
        const scopes = (existing.scopes as Array<{ name: string }>) ?? [];
        if (!scopes.some((s) => s.name === name)) {
          throw new Error(
            `DHCP scope '${name}' does not exist. Use dhcp_create_scope first.`
          );
        }

        const allowed = new Set([
          "newName",
          "startingAddress",
          "endingAddress",
          "subnetMask",
          "leaseTimeDays",
          "leaseTimeHours",
          "leaseTimeMinutes",
          "domainName",
          "domainSearchList",
          "routerAddress",
          "useThisDnsServer",
          "dnsServers",
          "ntpServers",
          "staticRoutes",
          "exclusions",
          "allowOnlyReservedLeases",
          "blockLocallyAdministeredMacAddresses",
        ]);
        const params: Record<string, string> = { name };
        for (const [k, v] of Object.entries(args)) {
          if (allowed.has(k) && v !== undefined) params[k] = String(v);
        }
        for (const ipField of ["startingAddress", "endingAddress", "subnetMask", "routerAddress"]) {
          if (params[ipField]) validateIp(params[ipField]);
        }
        const data = await client.callOrThrow("/api/dhcp/scopes/set", params);
        return JSON.stringify({ success: true, updated: name, ...data }, null, 2);
      },
    },
    {
      definition: {
        name: "dhcp_delete_scope",
        description:
          "Permanently delete a DHCP scope, including all its reservations and lease history. Requires confirm=true.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Scope name to delete" },
            confirm: {
              type: "boolean",
              description: "Must be true to confirm deletion. Without this, returns a warning instead.",
            },
          },
          required: ["name"],
        },
      },
      readonly: false,
      handler: async (args) => {
        const name = validateStringLength(args.name as string, 256, "name");
        if (args.confirm !== true) {
          return JSON.stringify(
            {
              warning: `This will permanently delete DHCP scope '${name}' and all its reservations. Set confirm=true to proceed.`,
            },
            null,
            2
          );
        }
        const data = await client.callOrThrow("/api/dhcp/scopes/delete", { name });
        return JSON.stringify({ success: true, deleted: name, ...data }, null, 2);
      },
    },
    {
      definition: {
        name: "dhcp_set_scope_enabled",
        description:
          "Enable or disable a DHCP scope. Disabled scopes preserve their configuration but stop serving leases.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Scope name" },
            enabled: { type: "boolean", description: "true to enable, false to disable" },
          },
          required: ["name", "enabled"],
        },
      },
      readonly: false,
      handler: async (args) => {
        const name = validateStringLength(args.name as string, 256, "name");
        const endpoint = args.enabled
          ? "/api/dhcp/scopes/enable"
          : "/api/dhcp/scopes/disable";
        const data = await client.callOrThrow(endpoint, { name });
        return JSON.stringify(
          { success: true, scope: name, enabled: !!args.enabled, ...data },
          null,
          2
        );
      },
    },

    // -----------------------------------------------------------------------
    // Reserved-lease tools
    // -----------------------------------------------------------------------
    {
      definition: {
        name: "dhcp_list_reservations",
        description:
          "List all static reservations in a DHCP scope. Returns the reservedLeases[] array (each entry has hardwareAddress, address, hostName, comments).",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Scope name" },
          },
          required: ["name"],
        },
      },
      readonly: true,
      handler: async (args) => {
        const name = validateStringLength(args.name as string, 256, "name");
        const data = await client.callOrThrow("/api/dhcp/scopes/get", { name });
        const reserved = (data.reservedLeases as ReservedLease[]) ?? [];
        return JSON.stringify(
          { scope: name, count: reserved.length, reservedLeases: reserved },
          null,
          2
        );
      },
    },
    {
      definition: {
        name: "dhcp_get_reservation",
        description:
          "Look up a single static reservation by MAC address within a scope. Returns the reservation object, or null if not found.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Scope name" },
            hardwareAddress: { type: "string", description: "MAC address (colon or dash separated)" },
          },
          required: ["name", "hardwareAddress"],
        },
      },
      readonly: true,
      handler: async (args) => {
        const name = validateStringLength(args.name as string, 256, "name");
        const mac = validateMacAddress(args.hardwareAddress as string);
        const found = await findReservation(client, name, mac);
        return JSON.stringify(
          { scope: name, hardwareAddress: mac, reservation: found },
          null,
          2
        );
      },
    },
    {
      definition: {
        name: "dhcp_create_reservation",
        description:
          "Add a static MAC→IP reservation to a DHCP scope. Fails if a reservation with the same MAC already exists — use dhcp_update_reservation to change one.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Scope name" },
            hardwareAddress: { type: "string", description: "Client MAC (colon or dash separated)" },
            ipAddress: { type: "string", description: "IP to reserve (must fall inside the scope's range)" },
            hostName: { type: "string", description: "Optional hostname (becomes DHCP option 12)" },
            comments: { type: "string", description: "Optional free-form notes" },
          },
          required: ["name", "hardwareAddress", "ipAddress"],
        },
      },
      readonly: false,
      handler: async (args) => {
        const name = validateStringLength(args.name as string, 256, "name");
        const hardwareAddress = validateMacAddress(args.hardwareAddress as string);
        const ipAddress = validateIp(args.ipAddress as string);

        const params: Record<string, string> = { name, hardwareAddress, ipAddress };
        if (args.hostName !== undefined) params.hostName = String(args.hostName);
        if (args.comments !== undefined) params.comments = String(args.comments);

        // Technitium's addReservedLease rejects duplicate MACs natively
        // ("A reserved lease with same hardware address already exists...").
        const data = await client.callOrThrow(
          "/api/dhcp/scopes/addReservedLease",
          params
        );
        return JSON.stringify(
          { success: true, scope: name, hardwareAddress, ipAddress, ...data },
          null,
          2
        );
      },
    },
    {
      definition: {
        name: "dhcp_update_reservation",
        description:
          "Update a static reservation's IP, hostname, or comments. Looks up the reservation by MAC (the immutable key), removes it, then re-adds it with merged fields. " +
          "If the re-add fails, the tool attempts to restore the original reservation.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Scope name" },
            hardwareAddress: { type: "string", description: "MAC of the reservation to update" },
            ipAddress: { type: "string", description: "Optional new IP" },
            hostName: { type: "string", description: "Optional new hostname" },
            comments: { type: "string", description: "Optional new comments" },
          },
          required: ["name", "hardwareAddress"],
        },
      },
      readonly: false,
      handler: async (args) => {
        const name = validateStringLength(args.name as string, 256, "name");
        const hardwareAddress = validateMacAddress(args.hardwareAddress as string);

        const existing = await findReservation(client, name, hardwareAddress);
        if (!existing) {
          throw new Error(
            `No reservation found for ${hardwareAddress} in scope '${name}'.`
          );
        }

        // For each field: caller-provided wins, otherwise inherit existing.
        // Empty string is treated as "clear" (i.e. don't pass to addReservedLease).
        const ipSource = (args.ipAddress as string) ?? (existing.address as string);
        if (!ipSource) {
          throw new Error(
            `Reservation for ${hardwareAddress} has no current IP and none was provided. Pass ipAddress to set one.`
          );
        }
        const merged: Record<string, string> = {
          name,
          hardwareAddress,
          ipAddress: validateIp(ipSource),
        };
        const newHost =
          args.hostName !== undefined ? String(args.hostName) : (existing.hostName ?? "");
        const newComments =
          args.comments !== undefined ? String(args.comments) : (existing.comments ?? "");
        if (newHost) merged.hostName = newHost;
        if (newComments) merged.comments = newComments;

        await client.callOrThrow("/api/dhcp/scopes/removeReservedLease", {
          name,
          hardwareAddress,
        });

        try {
          const data = await client.callOrThrow(
            "/api/dhcp/scopes/addReservedLease",
            merged
          );
          return JSON.stringify(
            {
              success: true,
              scope: name,
              hardwareAddress,
              previous: existing,
              updated: {
                ipAddress: merged.ipAddress,
                hostName: merged.hostName,
                comments: merged.comments,
              },
              ...data,
            },
            null,
            2
          );
        } catch (e) {
          const restoreParams: Record<string, string> = {
            name,
            hardwareAddress,
            ipAddress: String(existing.address ?? ""),
          };
          if (existing.hostName) restoreParams.hostName = String(existing.hostName);
          if (existing.comments) restoreParams.comments = String(existing.comments);
          let restored = false;
          try {
            await client.callOrThrow(
              "/api/dhcp/scopes/addReservedLease",
              restoreParams
            );
            restored = true;
          } catch {
            // restore also failed — surface both
          }
          throw new Error(
            `Update failed (${String(e)}). Original reservation ${restored ? "was restored" : "could NOT be restored — manual intervention required"}.`
          );
        }
      },
    },
    {
      definition: {
        name: "dhcp_delete_reservation",
        description:
          "Permanently remove a static reservation by MAC. Requires confirm=true. The client will fall back to dynamic-pool leases on its next renewal.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Scope name" },
            hardwareAddress: { type: "string", description: "MAC of the reservation to delete" },
            confirm: {
              type: "boolean",
              description: "Must be true to confirm deletion. Without this, returns a warning instead.",
            },
          },
          required: ["name", "hardwareAddress"],
        },
      },
      readonly: false,
      handler: async (args) => {
        const name = validateStringLength(args.name as string, 256, "name");
        const hardwareAddress = validateMacAddress(args.hardwareAddress as string);
        if (args.confirm !== true) {
          return JSON.stringify(
            {
              warning: `This will permanently delete the reservation for ${hardwareAddress} in scope '${name}'. Set confirm=true to proceed.`,
            },
            null,
            2
          );
        }
        const data = await client.callOrThrow(
          "/api/dhcp/scopes/removeReservedLease",
          { name, hardwareAddress }
        );
        return JSON.stringify(
          { success: true, scope: name, hardwareAddress, ...data },
          null,
          2
        );
      },
    },

    // -----------------------------------------------------------------------
    // Active lease tools
    // -----------------------------------------------------------------------
    {
      definition: {
        name: "dhcp_list_leases",
        description:
          "List all active DHCP leases across the server. Each lease has scope, type (Dynamic|Reserved), hardwareAddress, address, hostName, leaseObtained, leaseExpires. " +
          "Use the optional `scope` and `type` arguments to filter client-side. Active leases are CREATED by clients via the DHCP protocol — there is no create tool.",
        inputSchema: {
          type: "object",
          properties: {
            scope: { type: "string", description: "Optional scope name to filter by" },
            type: {
              type: "string",
              enum: ["Dynamic", "Reserved"],
              description: "Optional lease type filter",
            },
          },
        },
      },
      readonly: true,
      handler: async (args) => {
        const data = await client.callOrThrow("/api/dhcp/leases/list");
        let leases = (data.leases as Lease[]) ?? [];
        if (args.scope) {
          const scope = validateStringLength(args.scope as string, 256, "scope");
          leases = leases.filter((l) => l.scope === scope);
        }
        if (args.type) {
          const t = String(args.type);
          leases = leases.filter((l) => l.type === t);
        }
        return JSON.stringify({ count: leases.length, leases }, null, 2);
      },
    },
    {
      definition: {
        name: "dhcp_get_lease",
        description:
          "Look up a single active lease by MAC address or IP. Returns the lease object or null if not found.",
        inputSchema: {
          type: "object",
          properties: {
            hardwareAddress: { type: "string", description: "Client MAC (one-of with ipAddress)" },
            ipAddress: { type: "string", description: "Leased IP (one-of with hardwareAddress)" },
          },
        },
      },
      readonly: true,
      handler: async (args) => {
        if (!args.hardwareAddress && !args.ipAddress) {
          throw new Error("Provide hardwareAddress or ipAddress");
        }
        if (args.hardwareAddress && args.ipAddress) {
          throw new Error("Provide hardwareAddress OR ipAddress, not both");
        }
        const data = await client.callOrThrow("/api/dhcp/leases/list");
        const leases = (data.leases as Lease[]) ?? [];
        let match: Lease | null = null;
        if (args.hardwareAddress) {
          const target = normalizeMacForCompare(
            validateMacAddress(args.hardwareAddress as string)
          );
          match =
            leases.find(
              (l) => l.hardwareAddress && normalizeMacForCompare(l.hardwareAddress) === target
            ) ?? null;
        } else if (args.ipAddress) {
          const ip = validateIp(args.ipAddress as string);
          match = leases.find((l) => l.address === ip) ?? null;
        }
        return JSON.stringify({ lease: match }, null, 2);
      },
    },
    {
      definition: {
        name: "dhcp_delete_lease",
        description:
          "Remove an active lease by MAC. Requires confirm=true. NOTE: this works for both Dynamic and Reserved leases — for a Reserved lease, removing the active lease does NOT delete the reservation itself; the client just gets a fresh lease on next renewal. Use dhcp_delete_reservation to remove the reservation.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Scope name the lease belongs to" },
            hardwareAddress: { type: "string", description: "MAC of the lease to remove" },
            confirm: {
              type: "boolean",
              description: "Must be true to confirm. Without this, returns a warning instead.",
            },
          },
          required: ["name", "hardwareAddress"],
        },
      },
      readonly: false,
      handler: async (args) => {
        const name = validateStringLength(args.name as string, 256, "name");
        const hardwareAddress = validateMacAddress(args.hardwareAddress as string);
        if (args.confirm !== true) {
          return JSON.stringify(
            {
              warning: `This will remove the active lease for ${hardwareAddress} in scope '${name}'. Set confirm=true to proceed.`,
            },
            null,
            2
          );
        }
        const data = await client.callOrThrow("/api/dhcp/leases/remove", {
          name,
          hardwareAddress,
        });
        return JSON.stringify(
          { success: true, scope: name, hardwareAddress, ...data },
          null,
          2
        );
      },
    },
    {
      definition: {
        name: "dhcp_convert_lease_to_reservation",
        description:
          "Promote an active dynamic lease into a permanent reservation, preserving its current IP. The client keeps the same address; future renewals are guaranteed.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Scope name" },
            hardwareAddress: { type: "string", description: "MAC of the lease to promote" },
          },
          required: ["name", "hardwareAddress"],
        },
      },
      readonly: false,
      handler: async (args) => {
        const name = validateStringLength(args.name as string, 256, "name");
        const hardwareAddress = validateMacAddress(args.hardwareAddress as string);
        const data = await client.callOrThrow(
          "/api/dhcp/leases/convertToReserved",
          { name, hardwareAddress }
        );
        return JSON.stringify(
          { success: true, scope: name, hardwareAddress, promoted: true, ...data },
          null,
          2
        );
      },
    },
    {
      definition: {
        name: "dhcp_convert_reservation_to_lease",
        description:
          "Demote a reservation back to a dynamic lease. The reservation entry is removed; the client retains its current IP only until the next pool renumber.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Scope name" },
            hardwareAddress: { type: "string", description: "MAC of the reservation to demote" },
          },
          required: ["name", "hardwareAddress"],
        },
      },
      readonly: false,
      handler: async (args) => {
        const name = validateStringLength(args.name as string, 256, "name");
        const hardwareAddress = validateMacAddress(args.hardwareAddress as string);
        const data = await client.callOrThrow(
          "/api/dhcp/leases/convertToDynamic",
          { name, hardwareAddress }
        );
        return JSON.stringify(
          { success: true, scope: name, hardwareAddress, demoted: true, ...data },
          null,
          2
        );
      },
    },
  ];
}
