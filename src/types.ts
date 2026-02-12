export type DocFormat = "direct-json" | "direct-yaml" | "scalar" | "swagger-ui" | "redoc" | "unknown";

export interface FetchResult {
  content: string;
  contentType: string;
  url: string;
}

export interface ExtractResult {
  success: boolean;
  spec?: object;
  error?: string;
}

export interface OpenAPISpec {
  openapi?: string;
  swagger?: string;
  info?: {
    title?: string;
    version?: string;
  };
  paths?: Record<string, unknown>;
  [key: string]: unknown;
}
