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

# Register with Claude Code
claude mcp add technitium-dns \
  --env TECHNITIUM_URL=https://10.0.0.15:5380 \
  --env TECHNITIUM_TOKEN=your-api-token \
  -- node /path/to/technitium-mcp-secure/dist/index.js
```

## Configuration

All configuration is via environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `TECHNITIUM_URL` | Yes | Server URL (e.g. `https://10.0.0.15:5380`) |
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

Create a non-expiring API token in the Technitium web admin:

```
Settings > Sessions > Create Token
```

Or via the API:

```bash
curl -X POST 'https://your-server:5380/api/user/createToken' \
  -d 'user=admin&pass=yourpassword&tokenName=mcp-server'
```

### Read-only Mode

For monitoring-only use cases:

```bash
claude mcp add technitium-dns-readonly \
  --env TECHNITIUM_URL=https://10.0.0.15:5380 \
  --env TECHNITIUM_TOKEN=your-token \
  --env TECHNITIUM_READONLY=true \
  -- node /path/to/dist/index.js
```

### Rate Limits

- Global: 100 requests/minute
- Create/mutate operations: 10/minute
- Delete/flush operations: 5/minute

### Audit Log

All tool calls are logged as JSONL to stderr with timestamps, tool name, sanitized arguments, result status, and duration. Sensitive values (tokens, passwords) are redacted before logging.

## Requirements

- Node.js >= 18
- Technitium DNS Server v14+

## License

MIT
