export interface AuthConfig {
  type: "bearer" | "apiKey" | "basic";
  token?: string;
  username?: string;
  password?: string;
  headerName?: string;
}

export class HttpClient {
  private baseUrl: string;
  private headers: Record<string, string> = {};
  private auth?: AuthConfig;
  private allowInsecure: boolean;

  private static readonly PRIVATE_IP_PATTERNS = [
    /^https?:\/\/localhost/i,
    /^https?:\/\/127\./,
    /^https?:\/\/10\./,
    /^https?:\/\/172\.(1[6-9]|2\d|3[01])\./,
    /^https?:\/\/192\.168\./,
    /^https?:\/\/169\.254\./,
    /^https?:\/\/0\./,
    /^https?:\/\/\[::1\]/,
    /^https?:\/\/\[fc/i,
    /^https?:\/\/\[fd/i,
  ];

  private static isPrivateUrl(url: string): boolean {
    return HttpClient.PRIVATE_IP_PATTERNS.some(pattern => pattern.test(url));
  }

  constructor(baseUrl: string, options?: { allowInsecure?: boolean }) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.headers["Content-Type"] = "application/json";
    this.allowInsecure = options?.allowInsecure ?? false;
  }

  setAuth(auth: AuthConfig): void { this.auth = auth; }
  setHeader(name: string, value: string): void { this.headers[name] = value; }

  getHeaders(): Record<string, string> {
    const headers = { ...this.headers };
    if (this.auth) {
      if (this.auth.type === "bearer" && this.auth.token) {
        headers["Authorization"] = `Bearer ${this.auth.token}`;
      } else if (this.auth.type === "apiKey" && this.auth.token) {
        headers[this.auth.headerName || "X-API-Key"] = this.auth.token;
      } else if (this.auth.type === "basic" && this.auth.username && this.auth.password) {
        headers["Authorization"] = `Basic ${btoa(`${this.auth.username}:${this.auth.password}`)}`;
      }
    }
    return headers;
  }

  buildUrl(path: string, pathParams: Record<string, string> = {}, queryParams: Record<string, string> = {}): string {
    let url = path;
    for (const [key, value] of Object.entries(pathParams)) {
      url = url.replace(`{${key}}`, encodeURIComponent(value));
    }
    const fullUrl = `${this.baseUrl}${url}`;
    const query = new URLSearchParams(queryParams).toString();
    return query ? `${fullUrl}?${query}` : fullUrl;
  }

  async request<T = unknown>(method: string, path: string, options: {
    pathParams?: Record<string, string>;
    queryParams?: Record<string, string>;
    body?: unknown;
  } = {}): Promise<{ data: T; status: number; headers: Headers }> {
    const url = this.buildUrl(path, options.pathParams, options.queryParams);

    if (HttpClient.isPrivateUrl(url)) {
      throw new Error(`Request blocked: ${new URL(url).hostname} appears to be a private/internal address`);
    }

    if (url.startsWith("http://") && !this.allowInsecure) {
      if (this.auth) {
        throw new Error("Refusing to send credentials over HTTP. Use HTTPS or set allowInsecure option.");
      }
      console.error("Warning: Making request over insecure HTTP connection");
    }

    const response = await fetch(url, {
      method,
      headers: this.getHeaders(),
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    return { data: data as T, status: response.status, headers: response.headers };
  }
}
