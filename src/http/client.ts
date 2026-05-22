import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig
} from "axios";

const THROTTLE_MAX_RETRIES = 3;
const THROTTLE_BASE_MS = 1000;
const OCC_MAX_RETRIES = 2;

type RetryConfig = InternalAxiosRequestConfig & { _retry429?: number };

export class TaigaError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly context?: Record<string, string | number>
  ) {
    super(message);
    this.name = "TaigaError";
  }
}

function taigaApiUrl(): string {
  return process.env.TAIGA_API_URL?.replace(/\/$/, "") ?? "";
}

function taigaToken(): string {
  return process.env.TAIGA_TOKEN ?? "";
}

function requireConfig(): void {
  if (!taigaApiUrl() || !taigaToken()) {
    throw new TaigaError(
      "Missing TAIGA_API_URL or TAIGA_TOKEN. Set them in environment or .env."
    );
  }
}

export function wrapAxiosError(
  err: unknown,
  context?: Record<string, string | number>
): TaigaError {
  if (err instanceof TaigaError) return err;
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<{ detail?: string; _error_message?: string }>;
    const status = ax.response?.status;
    const body = ax.response?.data;
    const detail =
      (typeof body === "object" && body !== null
        ? body.detail ?? body._error_message
        : undefined) ?? ax.message;
    const ctxStr = context
      ? ` — ${Object.entries(context)
          .map(([k, v]) => `${k}=${v}`)
          .join(" ")}`
      : "";
    return new TaigaError(
      `Taiga API error (${status ?? "network"}): ${detail}${ctxStr}`,
      status,
      context
    );
  }
  return new TaigaError(err instanceof Error ? err.message : String(err), undefined, context);
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
      Authorization: `Bearer ${taigaToken()}`,
      "Content-Type": "application/json"
    }
  });
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as RetryConfig | undefined;
      if (
        error.response?.status === 429 &&
        config &&
        (config._retry429 ?? 0) < THROTTLE_MAX_RETRIES
      ) {
        config._retry429 = (config._retry429 ?? 0) + 1;
        await sleep(THROTTLE_BASE_MS * config._retry429);
        return instance.request(config);
      }
      return Promise.reject(error);
    }
  );
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
}

/** @internal Inject mock Axios instance (tests only). */
export function setClientForTests(instance: AxiosInstance | null): void {
  client = instance;
}

export async function patchWithOCC<T extends { version: number }>(
  fetchCurrent: () => Promise<T>,
  patch: (entity: T) => Promise<void>
): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= OCC_MAX_RETRIES; attempt++) {
    try {
      const entity = await fetchCurrent();
      await patch(entity);
      return;
    } catch (e) {
      lastErr = e;
      if (attempt < OCC_MAX_RETRIES && isVersionConflict(e)) continue;
      throw wrapAxiosError(e);
    }
  }
  throw wrapAxiosError(lastErr);
}
