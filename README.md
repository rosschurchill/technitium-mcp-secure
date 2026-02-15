# technitium-mcp-secure

A security-hardened [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server for managing [Technitium DNS Server](https://technitium.com/dns/) via its HTTP API.

Built for use with [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and other MCP-compatible clients.

## Features

- **39 tools** covering DNS zones, records, blocking, cache, settings, apps, DNSSEC, logs, and diagnostics
- **Input validation** on all parameters (RFC 1035 domain checks, IP validation, enum allowlists)
- **HTTPS enforcement** with explicit HTTP opt-in for local networks
- **Read-only mode** to expose only safe query tools
- **Confirmation required** for destructive operations (delete zone, delete record, flush cache/allow/block, uninstall app)
- **Rate limiting** with stricter limits on destructive operations
- **Audit logging** as structured JSONL to stderr
- **Response sanitization** to strip tokens, passwords, stack traces, and sensitive paths
- **Error sanitization** to prevent credential/path leakage in error messages
- **Token file support** for secure credential storage
- **Auth mutex** to prevent concurrent authentication races
- **POST-only API calls** to keep tokens out of query strings and server logs

## Quick Start

```bash
# Clone and build
git clone https://github.com/rosschurchill/technitium-mcp-secure.git
cd technitium-mcp-secure
npm install
npm run build

# Register with Claude Code (see "Generating an API Token" below first)
claude mcp add technitium-dns \
  --env TECHNITIUM_URL=https://your-server-ip:5380 \
  --env TECHNITIUM_TOKEN=your-api-token \
  -- node /path/to/technitium-mcp-secure/dist/index.js
```

## Configuration

All configuration is via environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `TECHNITIUM_URL` | Yes | Server URL (e.g. `https://192.168.1.100:5380`) |
| `TECHNITIUM_TOKEN` | One of token/password | API token (preferred) |
| `TECHNITIUM_TOKEN_FILE` | One of token/password | Path to file containing token (must be mode 0600) |
| `TECHNITIUM_PASSWORD` | One of token/password | Admin password (token is preferred) |
| `TECHNITIUM_USER` | No | Username (default: `admin`) |
| `TECHNITIUM_READONLY` | No | Set `true` to hide all write tools |
| `TECHNITIUM_ALLOW_HTTP` | No | Set `true` to allow insecure HTTP connections |

Authentication priority: `TECHNITIUM_TOKEN` > `TECHNITIUM_TOKEN_FILE` > `TECHNITIUM_PASSWORD`

Sensitive environment variables are cleared from `process.env` after being read.

## Tools

### Read-only (18 tools)

| Tool | Description |
|------|-------------|
| `dns_health_check` | Server version, uptime, forwarder config, failure rate |
| `dns_get_stats` | Query statistics with top clients/domains/blocked |
| `dns_check_update` | Check if a newer server version is available |
| `dns_resolve` | Test DNS resolution via the server |
| `dns_list_zones` | List all configured zones |
| `dns_zone_options` | Zone DNSSEC, transfer, and notify settings |
| `dns_export_zone` | Export a zone file in BIND format |
| `dns_list_records` | List records in a zone |
| `dns_list_blocked` | List blocked domains (hierarchical, supports drill-down) |
| `dns_list_allowed` | List allowed domains (hierarchical, supports drill-down) |
| `dns_list_cache` | List cached zones (hierarchical, supports drill-down) |
| `dns_get_settings` | Full server settings |
| `dns_query_logs` | Query DNS logs with filters |
| `dns_list_apps` | List installed DNS apps |
| `dns_list_app_store` | List available apps from the Technitium app store |
| `dns_get_app_config` | Get configuration for an installed app |
| `dns_dnssec_info` | DNSSEC properties for a zone |
| `dns_get_ds` | DS records for a DNSSEC-signed zone |

### Write (21 tools)

| Tool | Description |
|------|-------------|
| `dns_create_zone` | Create a new DNS zone |
| `dns_delete_zone` | Delete a zone (requires `confirm: true`) |
| `dns_enable_zone` | Enable a disabled zone |
| `dns_disable_zone` | Disable a zone (preserves records) |
| `dns_set_zone_options` | Update zone configuration (notify, transfer ACLs) |
| `dns_add_record` | Add a DNS record |
| `dns_update_record` | Update an existing record |
| `dns_delete_record` | Delete a record (requires `confirm: true`) |
| `dns_block_domain` | Block a domain |
| `dns_remove_blocked` | Remove a domain from the block list |
| `dns_flush_blocked` | Flush entire custom block list (requires `confirm: true`) |
| `dns_allow_domain` | Allow a domain (bypass block lists) |
| `dns_remove_allowed` | Remove a domain from the allow list |
| `dns_flush_allowed` | Flush entire allow list (requires `confirm: true`) |
| `dns_flush_cache` | Flush DNS cache (requires `confirm: true`) |
| `dns_delete_cached` | Delete a specific domain from cache |
| `dns_set_settings` | Update server settings (forwarders, blocking, etc.) |
| `dns_update_blocklists` | Force immediate block list update |
| `dns_temp_disable_blocking` | Temporarily disable blocking (auto re-enables) |
| `dns_install_app` | Install a DNS app from the app store |
| `dns_uninstall_app` | Uninstall an app (requires `confirm: true`) |

## Security

### Generating an API Token

An API token is the recommended way to authenticate. Tokens avoid sending your admin password on every request and can be revoked independently.

**Option A: Web Admin UI**

1. Open the Technitium web admin (e.g. `http://your-server-ip:5380`)
2. Log in with your admin credentials
3. Go to **Administration** (gear icon, top right)
4. Scroll down to **Sessions**
5. Under **Create API Token**, enter a name (e.g. `mcp-server`)
6. Click **Create**
7. Copy the token value shown - this is the only time it will be displayed

**Option B: API (curl)**

```bash
# Login first to get a session token
curl -s -X POST 'http://your-server-ip:5380/api/user/login' \
  -d 'user=admin&pass=yourpassword' | jq -r '.response.token'

# Then create a non-expiring API token using the session token
curl -s -X POST 'http://your-server-ip:5380/api/user/createToken' \
  -d 'user=admin&pass=yourpassword&tokenName=mcp-server' | jq -r '.response.token'
```

**Storing the token securely:**

```bash
# Option 1: Pass directly as env var (simplest)
claude mcp add technitium-dns \
  --env TECHNITIUM_TOKEN=your-token-here ...

# Option 2: Use a token file (more secure - keeps token out of shell history)
echo "your-token-here" > ~/.technitium-token
chmod 600 ~/.technitium-token

claude mcp add technitium-dns \
  --env TECHNITIUM_TOKEN_FILE=~/.technitium-token ...
```

### Local Network (HTTP)

If your Technitium server doesn't have TLS configured (common for LAN-only setups), you need to explicitly allow HTTP:

```bash
claude mcp add technitium-dns \
  --env TECHNITIUM_URL=http://your-server-ip:5380 \
  --env TECHNITIUM_TOKEN=your-token \
  --env TECHNITIUM_ALLOW_HTTP=true \
  -- node /path/to/technitium-mcp-secure/dist/index.js
```

A warning will be logged to stderr reminding you that credentials are sent in plaintext.

### Read-only Mode

For monitoring-only use cases, hide all write tools:

```bash
claude mcp add technitium-dns-readonly \
  --env TECHNITIUM_URL=http://your-server-ip:5380 \
  --env TECHNITIUM_TOKEN=your-token \
  --env TECHNITIUM_READONLY=true \
  --env TECHNITIUM_ALLOW_HTTP=true \
  -- node /path/to/dist/index.js
```

### Rate Limits

- Global: 100 requests/minute
- Create/mutate operations: 10/minute
- Delete/flush operations: 5/minute

### Audit Log

All tool calls are logged as JSONL to stderr with timestamps, tool name, sanitized arguments, result status, and duration. Sensitive values (tokens, passwords) are redacted before logging.

## Not Yet Implemented

The Technitium API has ~173 endpoints. This MCP server covers the most useful 36. The following categories are available in the API but not yet exposed:

- **DHCP management** — scopes, leases, reservations (~12 endpoints)
- **User & group administration** — create/delete users, manage groups, permissions (~15 endpoints)
- **Cluster management** — multi-server clustering, health, failover (~15 endpoints)
- **Zone import/clone/convert** — import from file, clone from another server, convert zone types
- **DNSSEC signing & key management** — sign/unsign zones, rotate keys, algorithm config
- **Allowed/blocked zone import/export** — bulk import/export from files
- **Settings backup/restore** — full server config backup and restore
- **Log management** — log file deletion, log settings changes

If you need any of these, contributions are welcome or open an issue.

## Compatibility

Tested against **Technitium DNS Server v14.3** on Alpine Linux. All 36 API endpoints verified against the live v14 API.

**Note:** Technitium's API paths changed between versions. If you see 404 errors, check that your server version is v14+. Earlier versions used different paths (e.g. `/api/allowedZones/list` instead of `/api/allowed/list`).

## Requirements

- Node.js >= 18
- Technitium DNS Server v14+

## Changelog

### v1.2.0
- Add 19 new tools (39 total): remove/flush allowed & blocked, delete cached, enable/disable/configure/export zones, server settings management, temporary blocking disable, block list updates, app store/install/uninstall/config, DNSSEC info, update check
- All 36 API endpoints verified returning 200 against live Technitium v14.3
- Add "Not Yet Implemented" section documenting available API categories

### v1.1.1
- Fix `dns_resolve` missing required `server` parameter (now defaults to `this-server`)
- Fix `dns_query_logs` missing `name` and `classPath` params for Query Logs (Sqlite) app
- Fix `dns_list_allowed`, `dns_allow_domain` using wrong API path (`/api/allowedZones/*` -> `/api/allowed/*`)
- Fix `dns_list_blocked`, `dns_block_domain` using wrong API path (`/api/blockedZones/*` -> `/api/blocked/*`)
- Fix `dns_list_cache` using wrong API path (`/api/cache/zones/list` -> `/api/cache/list`)
- Fix `dns_allow_domain`, `dns_block_domain` using wrong param name (`zone` -> `domain`)
- All 17 API endpoints verified returning 200 against live Technitium v14.3

### v1.1.0
- Security hardening: input validation, audit logging, rate limiting, response sanitization
- HTTPS enforcement with HTTP opt-in, read-only mode, confirmation for destructive ops
- Token file support, auth mutex, POST-only API calls, env var clearing

### v1.0.0
- Initial release with 20 tools for DNS management

## License

MIT
