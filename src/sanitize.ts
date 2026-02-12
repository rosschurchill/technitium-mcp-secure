const SENSITIVE_PATTERNS: [RegExp, string][] = [
  // Hex tokens (20+ chars)
  [/\b[0-9a-f]{20,}\b/gi, "[REDACTED_TOKEN]"],
  // URLs with credentials
  [/https?:\/\/[^:]+:[^@]+@[^\s]+/g, "[REDACTED_URL]"],
  // File paths (Unix)
  [/\/(?:opt|home|etc|var|tmp|usr)\/[\w./-]+/g, "[REDACTED_PATH]"],
  // Windows paths
  [/[A-Z]:\\[\w\\.-]+/gi, "[REDACTED_PATH]"],
  // Stack traces
  [/at\s+\w+.*\(.*:\d+:\d+\)/g, "[STACK_TRACE]"],
  [/\s+in\s+\w+.*\\.*\.cs:line\s+\d+/g, "[STACK_TRACE]"],
];

export function sanitizeError(message: string): string {
  let sanitized = message;
  for (const [pattern, replacement] of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

const SENSITIVE_KEYS = new Set([
  "password",
  "pass",
  "secret",
  "token",
  "apiKey",
  "apikey",
  "api_key",
  "privateKey",
  "privatekey",
  "private_key",
  "connectionString",
  "connectionstring",
  "connection_string",
  "tlsCertificatePassword",
  "dnsTlsCertificatePassword",
  "webServiceTlsCertificatePassword",
  "proxyPassword",
]);

export function sanitizeResponse(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data === "string") return sanitizeString(data);
  if (Array.isArray(data)) return data.map(sanitizeResponse);
  if (typeof data === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key)) {
        result[key] = "[REDACTED]";
      } else if (key === "stackTrace") {
        continue; // Strip stack traces entirely
      } else {
        result[key] = sanitizeResponse(value);
      }
    }
    return result;
  }
  return data;
}

function sanitizeString(value: string): string {
  // Redact long hex strings that look like tokens
  return value.replace(/\b[0-9a-f]{32,}\b/gi, "[REDACTED_TOKEN]");
}

export function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}:${parsed.port || "?"}`;
  } catch {
    return "[INVALID_URL]";
  }
}
