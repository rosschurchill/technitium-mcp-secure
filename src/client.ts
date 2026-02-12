import { Config } from "./config.js";
import { TechnitiumResponse } from "./types.js";
import { audit } from "./audit.js";

export class TechnitiumClient {
  private sessionToken: string | null = null;
  private config: Config;
  private authInFlight: Promise<void> | null = null;

  constructor(config: Config) {
    this.config = config;
    if (config.token) {
      this.sessionToken = config.token;
    }
  }

  private async authenticate(): Promise<void> {
    if (this.config.token) {
      this.sessionToken = this.config.token;
      audit.logAuth("token_loaded", true);
      return;
    }

    if (!this.config.password) {
      throw new Error("No token or password configured");
    }

    const body = new URLSearchParams({
      user: this.config.user,
      pass: this.config.password,
    });

    const resp = await fetch(`${this.config.url}/api/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const data = (await resp.json()) as TechnitiumResponse;

    if (data.status !== "ok" || !data.response) {
      audit.logAuth("login", false, data.errorMessage);
      throw new Error("Authentication failed");
    }

    this.sessionToken = data.response.token as string;
    audit.logAuth("login", true);
  }

  private async ensureAuth(): Promise<void> {
    if (this.sessionToken) return;

    // Mutex: if auth is already in-flight, wait for it
    if (this.authInFlight) {
      await this.authInFlight;
      return;
    }

    this.authInFlight = this.authenticate().finally(() => {
      this.authInFlight = null;
    });
    await this.authInFlight;
  }

  async call(
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<TechnitiumResponse> {
    await this.ensureAuth();

    const result = await this.doCall(endpoint, params);

    if (result.status === "invalid-token") {
      this.sessionToken = null;
      audit.logAuth("token_expired", false);
      await this.ensureAuth();
      return this.doCall(endpoint, params);
    }

    return result;
  }

  private async doCall(
    endpoint: string,
    params: Record<string, string>
  ): Promise<TechnitiumResponse> {
    const body = new URLSearchParams({
      ...params,
      token: this.sessionToken!,
    });

    const resp = await fetch(`${this.config.url}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    return (await resp.json()) as TechnitiumResponse;
  }

  async callOrThrow(
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<Record<string, unknown>> {
    const result = await this.call(endpoint, params);

    if (result.status !== "ok") {
      throw new Error(
        result.errorMessage || `API error: ${result.status}`
      );
    }

    return result.response || {};
  }

  clearToken(): void {
    this.sessionToken = null;
  }
}
