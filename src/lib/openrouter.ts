const BASE_URL = "https://openrouter.ai/api/v1";

export function getOpenRouterApiKey(): string {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPEN_ROUTER_API_KEY");
  }
  return apiKey;
}

export function getOpenRouterConfiguration(): {
  baseURL: string;
  defaultHeaders?: Record<string, string>;
} {
  const defaultHeaders: Record<string, string> = {};

  if (process.env.OPEN_ROUTER_HTTP_REFERER) {
    defaultHeaders["HTTP-Referer"] = process.env.OPEN_ROUTER_HTTP_REFERER;
  }

  if (process.env.OPEN_ROUTER_TITLE) {
    defaultHeaders["X-Title"] = process.env.OPEN_ROUTER_TITLE;
  }

  return Object.keys(defaultHeaders).length > 0
    ? { baseURL: BASE_URL, defaultHeaders }
    : { baseURL: BASE_URL };
}
