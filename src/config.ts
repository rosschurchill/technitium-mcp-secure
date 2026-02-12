import { readFileSync, statSync } from "node:fs";

export interface Config {
  url: string;
  user: string;
  token?: string;
  password?: string;
  readonly: boolean;
  allowHttp: boolean;
}

export function loadConfig(): Config {
  const url = process.env.TECHNITIUM_URL;
  if (!url) {
    throw new Error(
      "TECHNITIUM_URL environment variable is required (e.g. https://10.0.0.15:5380)"
    );
  }

  const cleanUrl = url.replace(/\/$/, "");
  const allowHttp = process.env.TECHNITIUM_ALLOW_HTTP === "true";

  if (cleanUrl.startsWith("http://") && !allowHttp) {
    throw new Error(
      "TECHNITIUM_URL uses HTTP (insecure). Set TECHNITIUM_ALLOW_HTTP=true to override, or use HTTPS."
    );
  }

  if (cleanUrl.startsWith("http://") && allowHttp) {
    console.error(
      "[technitium-mcp] WARNING: Using HTTP - credentials transmitted in plaintext"
    );
  }

  // Token priority: env token > token file > password
  let token = process.env.TECHNITIUM_TOKEN;

  if (!token && process.env.TECHNITIUM_TOKEN_FILE) {
    const tokenFile = process.env.TECHNITIUM_TOKEN_FILE;
    try {
      const stat = statSync(tokenFile);
      const mode = stat.mode & 0o777;
      if (mode & 0o077) {
        console.error(
          `[technitium-mcp] WARNING: Token file ${tokenFile} has loose permissions (${mode.toString(8)}). Should be 0600.`
        );
      }
      token = readFileSync(tokenFile, "utf-8").trim();
    } catch (err) {
      throw new Error(`Cannot read token file: ${(err as Error).message}`);
    }
  }

  const password = process.env.TECHNITIUM_PASSWORD;
  const user = process.env.TECHNITIUM_USER || "admin";
  const readonly = process.env.TECHNITIUM_READONLY === "true";

  if (!token && !password) {
    throw new Error(
      "Set TECHNITIUM_TOKEN, TECHNITIUM_TOKEN_FILE, or TECHNITIUM_PASSWORD"
    );
  }

  // Clear sensitive env vars from process
  delete process.env.TECHNITIUM_TOKEN;
  delete process.env.TECHNITIUM_TOKEN_FILE;
  delete process.env.TECHNITIUM_PASSWORD;

  return { url: cleanUrl, user, token, password, readonly, allowHttp };
}
