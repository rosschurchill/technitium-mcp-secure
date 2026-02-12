import { Config } from "./config.js";
import { TechnitiumResponse } from "./types.js";

export class TechnitiumClient {
  private sessionToken: string | null = null;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    if (config.token) {
      this.sessionToken = config.token;
    }
  }

  private async authenticate(): Promise<void> {
    if (this.config.token) {
      this.sessionToken = this.config.token;
      return;
    }

    if (!this.config.password) {
      throw new Error("No token or password configured");
    }

    const params = new URLSearchParams({
      user: "admin",
      pass: this.config.password,
    });

    const resp = await fetch(
      `${this.config.url}/api/user/login?${params.toString()}`
    );
    const data = (await resp.json()) as TechnitiumResponse;

    if (data.status !== "ok" || !data.response) {
      throw new Error(
        `Authentication failed: ${data.errorMessage || "unknown error"}`
      );
    }

    this.sessionToken = data.response.token as string;
  }

  async call(
    endpoint: string,
    params: Record<string, string> = {},
    method: "GET" | "POST" = "GET"
  ): Promise<TechnitiumResponse> {
    if (!this.sessionToken) {
      await this.authenticate();
    }

    const result = await this.doCall(endpoint, params, method);

    if (result.status === "invalid-token") {
      this.sessionToken = null;
      await this.authenticate();
      return this.doCall(endpoint, params, method);
    }

    return result;
  }

  private async doCall(
    endpoint: string,
    params: Record<string, string>,
    method: "GET" | "POST"
  ): Promise<TechnitiumResponse> {
    const allParams = { ...params, token: this.sessionToken! };

    let resp: Response;

    if (method === "POST") {
      resp = await fetch(`${this.config.url}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(allParams).toString(),
      });
    } else {
      const qs = new URLSearchParams(allParams).toString();
      resp = await fetch(`${this.config.url}${endpoint}?${qs}`);
    }

    const data = (await resp.json()) as TechnitiumResponse;
    return data;
  }

  async callOrThrow(
    endpoint: string,
    params: Record<string, string> = {},
    method: "GET" | "POST" = "GET"
  ): Promise<Record<string, unknown>> {
    const result = await this.call(endpoint, params, method);

    if (result.status !== "ok") {
      throw new Error(
        `API error on ${endpoint}: ${result.errorMessage || result.status}`
      );
    }

    return result.response || {};
  }
}
