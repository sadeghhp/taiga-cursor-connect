import axios from "axios";
import { wrapAxiosError } from "./axios-util.js";
import { TaigaError } from "./errors.js";

export type TaigaAuthResponse = {
  auth_token: string;
  refresh?: string;
  username?: string;
  id?: number;
};

export type AuthMode = "login" | "token";

export const TAIGA_CONFIG_ERROR =
  "Missing Taiga credentials. Set TAIGA_API_URL and either TAIGA_USERNAME+TAIGA_PASSWORD or TAIGA_TOKEN (optionally TAIGA_REFRESH_TOKEN).";

let accessToken: string | null = null;
let refreshToken: string | null = null;
let authMode: AuthMode | null = null;
let loggedInUsername: string | null = null;

let refreshInFlight: Promise<void> | null = null;

export type AuthHttpClient = Pick<typeof axios, "post" | "get">;

const authHttp: AuthHttpClient = axios.create({
  headers: { "Content-Type": "application/json" }
});

let authHttpOverride: AuthHttpClient | null = null;

function authClient(): AuthHttpClient {
  return authHttpOverride ?? authHttp;
}

function taigaApiUrl(): string {
  return process.env.TAIGA_API_URL?.replace(/\/$/, "") ?? "";
}

function envUsername(): string {
  return process.env.TAIGA_USERNAME?.trim() ?? "";
}

function envPassword(): string {
  return process.env.TAIGA_PASSWORD ?? "";
}

function hasPasswordCredentials(): boolean {
  return envUsername().length > 0 && envPassword().length > 0;
}

/** @internal Reject partial username/password env pairs before login or token mode. */
export function validateAuthEnv(): void {
  const user = envUsername();
  const pass = envPassword();
  if (user.length > 0 && pass.length === 0) {
    throw new TaigaError("TAIGA_PASSWORD is required when TAIGA_USERNAME is set");
  }
  if (pass.length > 0 && user.length === 0) {
    throw new TaigaError("TAIGA_USERNAME is required when TAIGA_PASSWORD is set");
  }
}

function applyTokens(body: TaigaAuthResponse): void {
  if (!body.auth_token) {
    throw new TaigaError("Taiga login response missing auth_token");
  }
  accessToken = body.auth_token;
  // Taiga may omit refresh on some refresh responses; keep the previous refresh JWT.
  if (body.refresh) {
    refreshToken = body.refresh;
  }
  if (body.username) {
    loggedInUsername = body.username;
  }
}

function seedFromEnv(): void {
  const token = process.env.TAIGA_TOKEN?.trim();
  if (!token) return;
  accessToken = token;
  const refresh = process.env.TAIGA_REFRESH_TOKEN?.trim();
  if (refresh) refreshToken = refresh;
  authMode = "token";
}

function lazySeedFromEnv(): void {
  if (accessToken) return;
  seedFromEnv();
}

export function getApiUrl(): string {
  return taigaApiUrl();
}

export function getAuthMode(): AuthMode | null {
  return authMode;
}

export function getLoggedInUsername(): string | null {
  return loggedInUsername ?? (hasPasswordCredentials() ? envUsername() : null);
}

export function hasAuthConfigured(): boolean {
  if (!taigaApiUrl()) return false;
  validateAuthEnv();
  if (hasPasswordCredentials()) return true;
  if (accessToken || process.env.TAIGA_TOKEN?.trim()) return true;
  return false;
}

export function getAccessToken(): string {
  lazySeedFromEnv();
  if (!accessToken) {
    throw new TaigaError(TAIGA_CONFIG_ERROR);
  }
  return accessToken;
}

export function getRefreshToken(): string | null {
  if (refreshToken) return refreshToken;
  const fromEnv = process.env.TAIGA_REFRESH_TOKEN?.trim();
  return fromEnv || null;
}

export async function validateAccessToken(): Promise<void> {
  const base = taigaApiUrl();
  if (!base) {
    throw new TaigaError("Missing TAIGA_API_URL");
  }
  try {
    await authClient().get(`${base}/users/me`, {
      headers: { Authorization: `Bearer ${getAccessToken()}` }
    });
  } catch (e) {
    const wrapped = wrapAxiosError(e, { operation: "validate" });
    if (wrapped.status === 401 || wrapped.status === 403) {
      throw new TaigaError(
        `${wrapped.message}. Check TAIGA_TOKEN / TAIGA_REFRESH_TOKEN or use TAIGA_USERNAME+TAIGA_PASSWORD.`,
        wrapped.status
      );
    }
    throw wrapped;
  }
}

export async function loginWithPassword(
  username: string,
  password: string
): Promise<TaigaAuthResponse> {
  const base = taigaApiUrl();
  if (!base) {
    throw new TaigaError("Missing TAIGA_API_URL");
  }
  try {
    const { data } = await authClient().post<TaigaAuthResponse>(`${base}/auth`, {
      type: "normal",
      username,
      password
    });
    applyTokens(data);
    authMode = "login";
    return data;
  } catch (e) {
    throw wrapAxiosError(e, { operation: "login" });
  }
}

export async function refreshAccessToken(): Promise<void> {
  const refresh = getRefreshToken();
  if (!refresh) {
    throw new TaigaError(
      "No refresh token available. Set TAIGA_REFRESH_TOKEN or use TAIGA_USERNAME+TAIGA_PASSWORD."
    );
  }
  const base = taigaApiUrl();
  if (!base) {
    throw new TaigaError("Missing TAIGA_API_URL");
  }
  try {
    const { data } = await authClient().post<TaigaAuthResponse>(`${base}/auth/refresh`, {
      refresh
    });
    applyTokens(data);
  } catch (e) {
    throw wrapAxiosError(e, { operation: "refresh" });
  }
}

export async function refreshOrReauth(): Promise<void> {
  if (refreshInFlight) {
    return refreshInFlight;
  }
  refreshInFlight = (async () => {
    try {
      if (getRefreshToken()) {
        await refreshAccessToken();
        return;
      }
    } catch {
      // fall through to re-login
    }
    if (hasPasswordCredentials()) {
      await loginWithPassword(envUsername(), envPassword());
      return;
    }
    throw new TaigaError(
      "Taiga session expired. Re-authenticate: set TAIGA_REFRESH_TOKEN, or TAIGA_USERNAME+TAIGA_PASSWORD, or obtain a new TAIGA_TOKEN."
    );
  })();
  try {
    await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

export async function ensureAuthReady(): Promise<void> {
  const base = taigaApiUrl();
  if (!base) {
    throw new TaigaError(TAIGA_CONFIG_ERROR);
  }
  validateAuthEnv();
  if (hasPasswordCredentials()) {
    await loginWithPassword(envUsername(), envPassword());
    return;
  }
  const token = process.env.TAIGA_TOKEN?.trim();
  if (token) {
    seedFromEnv();
    await validateAccessToken();
    return;
  }
  throw new TaigaError(TAIGA_CONFIG_ERROR);
}

/** @internal Tests only. */
export function setTokensForTests(access: string, refresh?: string): void {
  accessToken = access;
  refreshToken = refresh ?? null;
  authMode = "token";
}

/** @internal Tests only. */
export function setAuthHttpForTests(client: AuthHttpClient | null): void {
  authHttpOverride = client;
}

/** @internal Tests only. */
export function resetAuthForTests(): void {
  accessToken = null;
  refreshToken = null;
  authMode = null;
  loggedInUsername = null;
  refreshInFlight = null;
  authHttpOverride = null;
}
