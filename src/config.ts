export interface Config {
  url: string;
  token?: string;
  password?: string;
}

export function loadConfig(): Config {
  const url = process.env.TECHNITIUM_URL;
  if (!url) {
    throw new Error(
      "TECHNITIUM_URL environment variable is required (e.g. http://10.0.0.184:5380)"
    );
  }

  const token = process.env.TECHNITIUM_TOKEN;
  const password = process.env.TECHNITIUM_PASSWORD;

  if (!token && !password) {
    throw new Error(
      "Either TECHNITIUM_TOKEN or TECHNITIUM_PASSWORD must be set"
    );
  }

  return { url: url.replace(/\/$/, ""), token, password };
}
