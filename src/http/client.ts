import { logHttpRetry } from "../mcp-log.js";
import {
  getAccessToken,
  getApiUrl,
  hasAuthConfigured,
  refreshOrReauth,
  resetAuthForTests,
  TAIGA_CONFIG_ERROR
} from "./auth.js";
import { wrapAxiosError } from "./axios-util.js";
import { TaigaError } from "./errors.js";
import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig
} from "axios";

export { TaigaError } from "./errors.js";
export { wrapAxiosError } from "./axios-util.js";

const THROTTLE_MAX_RETRIES = 3;
const THROTTLE_BASE_MS = 1000;
const OCC_MAX_RETRIES = 2;

type RetryConfig = InternalAxiosRequestConfig & {
  _retry429?: number;
  _retry401?: boolean;
};

function taigaApiUrl(): string {
  return getApiUrl();
}

function requireConfig(): void {
  if (!hasAuthConfigured()) {
    throw new TaigaError(TAIGA_CONFIG_ERROR);
  }
}

/** @internal Normalize request URL to a path for auth-endpoint checks. */
export function normalizeRequestPath(url: string): string {
  const withoutQuery = url.split("?")[0] ?? url;
  const pathOnly = withoutQuery.replace(/^https?:\/\/[^/]+/, "");
  if (pathOnly.startsWith("/")) return pathOnly;
  return `/${pathOnly}`;
}

/** @internal True for Taiga auth routes (avoid 401 retry loops). */
export function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) return false;
  const path = normalizeRequestPath(url);
  return path === "/auth" || path === "/auth/refresh" || path.endsWith("/auth/refresh");
}

/** @internal Attach Bearer auth, 401 refresh, and 429 retry interceptors. */
export function attachTaigaInterceptors(instance: AxiosInstance): void {
  instance.interceptors.request.use((config) => {
    config.headers.Authorization = `Bearer ${getAccessToken()}`;
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as RetryConfig | undefined;

      if (
        error.response?.status === 401 &&
        config &&
        !config._retry401 &&
        !isAuthEndpoint(config.url)
      ) {
        config._retry401 = true;
        const method = (config.method ?? "get").toUpperCase();
        const path = config.url ?? "";
        logHttpRetry("401", 1, 1, method, path);
        try {
          await refreshOrReauth();
          config.headers = config.headers ?? {};
          config.headers.Authorization = `Bearer ${getAccessToken()}`;
          return instance.request(config);
        } catch (authErr) {
          return Promise.reject(authErr);
        }
      }

      if (
        error.response?.status === 429 &&
        config &&
        (config._retry429 ?? 0) < THROTTLE_MAX_RETRIES
      ) {
        config._retry429 = (config._retry429 ?? 0) + 1;
        const attempt = config._retry429;
        const backoffMs = THROTTLE_BASE_MS * attempt;
        const method = (config.method ?? "get").toUpperCase();
        const path = config.url ?? "";
        logHttpRetry("429", attempt, THROTTLE_MAX_RETRIES, method, path);
        await sleep(backoffMs);
        return instance.request(config);
      }
      return Promise.reject(error);
    }
  );
}

/** @internal Base API URL for fetch-based uploads (multipart). */
export function getApiBaseUrl(): string {
  requireConfig();
  return taigaApiUrl();
}

/** @internal Bearer auth header for fetch-based uploads. */
export function getAuthHeaders(): Record<string, string> {
  requireConfig();
  return { Authorization: `Bearer ${getAccessToken()}` };
}

function isVersionConflict(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  const status = err.response?.status;
  if (status === 409) return true;
  const body = err.response?.data;
  if (typeof body === "object" && body !== null) {
    const detail = String((body as { detail?: string }).detail ?? "").toLowerCase();
    if (detail.includes("version")) return true;
  }
  return false;
}

let client: AxiosInstance | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createClient(): AxiosInstance {
  const instance = axios.create({
    baseURL: taigaApiUrl(),
    headers: {
      "Content-Type": "application/json"
    }
  });
  attachTaigaInterceptors(instance);
  return instance;
}

export function getClient(): AxiosInstance {
  requireConfig();
  if (!client) {
    client = createClient();
    client.defaults.headers.common["x-disable-pagination"] = "True";
  }
  return client;
}

export function paginationHeaders(page?: number, pageSize?: number): Record<string, string> {
  const h: Record<string, string> = { "x-disable-pagination": "False" };
  if (page != null) h.page = String(page);
  if (pageSize != null) h["x-paginated-by"] = String(pageSize);
  return h;
}

/** @internal Reset HTTP client (tests only). */
export function resetClient(): void {
  client = null;
  resetAuthForTests();
}

/** @internal Inject mock Axios instance (tests only). */
export function setClientForTests(instance: AxiosInstance | null): void {
  client = instance;
}

export async function patchWithOCC<T extends { version: number }>(
  fetchCurrent: () => Promise<T>,
  patch: (entity: T) => Promise<void>,
  logContext?: string
): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= OCC_MAX_RETRIES; attempt++) {
    try {
      const entity = await fetchCurrent();
      await patch(entity);
      return;
    } catch (e) {
      lastErr = e;
      if (attempt < OCC_MAX_RETRIES && isVersionConflict(e)) {
        logHttpRetry(
          "occ",
          attempt + 1,
          OCC_MAX_RETRIES,
          "PATCH",
          logContext ?? "entity"
        );
        continue;
      }
      throw wrapAxiosError(e);
    }
  }
  throw wrapAxiosError(lastErr);
}
