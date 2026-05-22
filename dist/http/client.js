import axios from "axios";
const THROTTLE_MAX_RETRIES = 3;
const THROTTLE_BASE_MS = 1000;
const OCC_MAX_RETRIES = 2;
export class TaigaError extends Error {
    status;
    context;
    constructor(message, status, context) {
        super(message);
        this.status = status;
        this.context = context;
        this.name = "TaigaError";
    }
}
function taigaApiUrl() {
    return process.env.TAIGA_API_URL?.replace(/\/$/, "") ?? "";
}
function taigaToken() {
    return process.env.TAIGA_TOKEN ?? "";
}
function requireConfig() {
    if (!taigaApiUrl() || !taigaToken()) {
        throw new TaigaError("Missing TAIGA_API_URL or TAIGA_TOKEN. Set them in environment or .env.");
    }
}
export function wrapAxiosError(err, context) {
    if (err instanceof TaigaError)
        return err;
    if (axios.isAxiosError(err)) {
        const ax = err;
        const status = ax.response?.status;
        const body = ax.response?.data;
        const detail = (typeof body === "object" && body !== null
            ? body.detail ?? body._error_message
            : undefined) ?? ax.message;
        const ctxStr = context
            ? ` — ${Object.entries(context)
                .map(([k, v]) => `${k}=${v}`)
                .join(" ")}`
            : "";
        return new TaigaError(`Taiga API error (${status ?? "network"}): ${detail}${ctxStr}`, status, context);
    }
    return new TaigaError(err instanceof Error ? err.message : String(err), undefined, context);
}
function isVersionConflict(err) {
    if (!axios.isAxiosError(err))
        return false;
    const status = err.response?.status;
    if (status === 409)
        return true;
    const body = err.response?.data;
    if (typeof body === "object" && body !== null) {
        const detail = String(body.detail ?? "").toLowerCase();
        if (detail.includes("version"))
            return true;
    }
    return false;
}
let client = null;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function createClient() {
    const instance = axios.create({
        baseURL: taigaApiUrl(),
        headers: {
            Authorization: `Bearer ${taigaToken()}`,
            "Content-Type": "application/json"
        }
    });
    instance.interceptors.response.use((response) => response, async (error) => {
        const config = error.config;
        if (error.response?.status === 429 &&
            config &&
            (config._retry429 ?? 0) < THROTTLE_MAX_RETRIES) {
            config._retry429 = (config._retry429 ?? 0) + 1;
            await sleep(THROTTLE_BASE_MS * config._retry429);
            return instance.request(config);
        }
        return Promise.reject(error);
    });
    return instance;
}
export function getClient() {
    requireConfig();
    if (!client) {
        client = createClient();
        client.defaults.headers.common["x-disable-pagination"] = "True";
    }
    return client;
}
export function paginationHeaders(page, pageSize) {
    const h = { "x-disable-pagination": "False" };
    if (page != null)
        h.page = String(page);
    if (pageSize != null)
        h["x-paginated-by"] = String(pageSize);
    return h;
}
/** @internal Reset HTTP client (tests only). */
export function resetClient() {
    client = null;
}
/** @internal Inject mock Axios instance (tests only). */
export function setClientForTests(instance) {
    client = instance;
}
export async function patchWithOCC(fetchCurrent, patch) {
    let lastErr;
    for (let attempt = 0; attempt <= OCC_MAX_RETRIES; attempt++) {
        try {
            const entity = await fetchCurrent();
            await patch(entity);
            return;
        }
        catch (e) {
            lastErr = e;
            if (attempt < OCC_MAX_RETRIES && isVersionConflict(e))
                continue;
            throw wrapAxiosError(e);
        }
    }
    throw wrapAxiosError(lastErr);
}
