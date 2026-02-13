# technitium-mcp-secure

A security-hardened [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server for managing [Technitium DNS Server](https://technitium.com/dns/) via its HTTP API.

Built for use with [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and other MCP-compatible clients.

## Features

- **20 tools** covering DNS zones, records, blocking, cache, settings, logs, and diagnostics
- **Input validation** on all parameters (RFC 1035 domain checks, IP validation, enum allowlists)
- **HTTPS enforcement** with explicit HTTP opt-in for local networks
- **Read-only mode** to expose only safe query tools
- **Confirmation required** for destructive operations (delete zone, delete record, flush cache)
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

### Read-only (12 tools)

| Tool | Description |
|------|-------------|
| `dns_health_check` | Server version, uptime, forwarder config, failure rate |
| `dns_get_stats` | Query statistics with top clients/domains/blocked |
| `dns_resolve` | Test DNS resolution via the server |
| `dns_list_zones` | List all configured zones |
| `dns_zone_options` | Zone DNSSEC, transfer, and notify settings |
| `dns_list_records` | List records in a zone |
| `dns_list_blocked` | List blocked domains |
| `dns_list_allowed` | List allowed (whitelisted) domains |
| `dns_list_cache` | List cached zones |
| `dns_get_settings` | Full server settings |
| `dns_query_logs` | Query DNS logs with filters |
| `dns_list_apps` | List installed DNS apps |

### Write (8 tools)

| Tool | Description |
|------|-------------|
| `dns_create_zone` | Create a new DNS zone |
| `dns_delete_zone` | Delete a zone (requires `confirm: true`) |
| `dns_add_record` | Add a DNS record |
| `dns_update_record` | Update an existing record |
| `dns_delete_record` | Delete a record (requires `confirm: true`) |
| `dns_block_domain` | Block a domain |
| `dns_allow_domain` | Allow a domain (bypass block lists) |
| `dns_flush_cache` | Flush DNS cache (requires `confirm: true`) |

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

## Compatibility

Tested against **Technitium DNS Server v14.3** on Alpine Linux. All 17 API endpoints verified against the live v14 API.

**Note:** Technitium's API paths changed between versions. If you see 404 errors, check that your server version is v14+. Earlier versions used different paths (e.g. `/api/allowedZones/list` instead of `/api/allowed/list`).

## Requirements

- Node.js >= 18
- Technitium DNS Server v14+

## Changelog

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
