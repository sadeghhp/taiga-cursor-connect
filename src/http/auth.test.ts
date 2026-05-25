import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import axios, { AxiosError } from "axios";
import {
  ensureAuthReady,
  getAccessToken,
  getAuthMode,
  getRefreshToken,
  loginWithPassword,
  refreshAccessToken,
  refreshOrReauth,
  resetAuthForTests,
  setAuthHttpForTests,
  setTokensForTests,
  validateAuthEnv,
  type AuthHttpClient,
  type TaigaAuthResponse
} from "./auth.js";
import { getClient, resetClient, TaigaError } from "./client.js";
import { TaigaError as AuthTaigaError } from "./errors.js";

const ENV_KEYS = [
  "TAIGA_API_URL",
  "TAIGA_TOKEN",
  "TAIGA_REFRESH_TOKEN",
  "TAIGA_USERNAME",
  "TAIGA_PASSWORD"
] as const;

const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

function saveEnv(): void {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
}

function restoreEnv(): void {
  for (const key of ENV_KEYS) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

const loginBody: TaigaAuthResponse = {
  auth_token: "access-1",
  refresh: "refresh-1",
  username: "admin",
  id: 5
};

const refreshBody: TaigaAuthResponse = {
  auth_token: "access-2",
  refresh: "refresh-2",
  username: "admin",
  id: 5
};

function mockAuthHttp(
  handlers: {
    login?: () => TaigaAuthResponse;
    refresh?: () => TaigaAuthResponse;
    getMe?: () => unknown;
    getMeError?: () => never;
  }
): void {
  const client: AuthHttpClient = {
    post: async (url: string, _data: unknown) => {
      const path = String(url);
      if (path.endsWith("/auth/refresh")) {
        if (handlers.refresh) return { data: handlers.refresh() };
        throw new Error("unexpected refresh");
      }
      if (path.endsWith("/auth")) {
        if (handlers.login) return { data: handlers.login() };
        throw new Error("unexpected login");
      }
      throw new Error(`unexpected post ${path}`);
    },
    get: async (url: string) => {
      const path = String(url);
      if (path.endsWith("/users/me")) {
        if (handlers.getMeError) handlers.getMeError();
        if (handlers.getMe) return { data: handlers.getMe() };
        return { data: { username: "admin" } };
      }
      throw new Error(`unexpected get ${path}`);
    }
  };
  setAuthHttpForTests(client);
}

describe("auth", () => {
  beforeEach(() => {
    saveEnv();
    resetAuthForTests();
    resetClient();
  });

  afterEach(() => {
    resetAuthForTests();
    resetClient();
    restoreEnv();
  });

  it("ensureAuthReady seeds token mode and validates via users/me", async () => {
    process.env.TAIGA_API_URL = "http://taiga.test/api/v1";
    process.env.TAIGA_TOKEN = "env-token";
    process.env.TAIGA_REFRESH_TOKEN = "env-refresh";
    let meCalls = 0;
    mockAuthHttp({
      getMe: () => {
        meCalls++;
        return { username: "admin" };
      }
    });
    await ensureAuthReady();
    assert.equal(meCalls, 1);
    assert.equal(getAuthMode(), "token");
    assert.equal(getAccessToken(), "env-token");
    assert.equal(getRefreshToken(), "env-refresh");
  });

  it("ensureAuthReady rejects invalid TAIGA_TOKEN on users/me", async () => {
    process.env.TAIGA_API_URL = "http://taiga.test/api/v1";
    process.env.TAIGA_TOKEN = "bad-token";
    mockAuthHttp({
      getMeError: () => {
        const err = new AxiosError("Unauthorized");
        (err as AxiosError).response = { status: 401, data: { detail: "bad" } } as AxiosError["response"];
        throw err;
      }
    });
    await assert.rejects(() => ensureAuthReady(), (err: unknown) => {
      assert.ok(err instanceof AuthTaigaError);
      assert.match((err as AuthTaigaError).message, /TAIGA_TOKEN/);
      return true;
    });
  });

  it("ensureAuthReady logs in when username and password are set", async () => {
    process.env.TAIGA_API_URL = "http://taiga.test/api/v1";
    process.env.TAIGA_USERNAME = "admin";
    process.env.TAIGA_PASSWORD = "secret";
    process.env.TAIGA_TOKEN = "ignored-when-login";
    let loginCalls = 0;
    let meCalls = 0;
    mockAuthHttp({
      login: () => {
        loginCalls++;
        return loginBody;
      },
      getMe: () => {
        meCalls++;
        return { username: "admin" };
      }
    });
    await ensureAuthReady();
    assert.equal(loginCalls, 1);
    assert.equal(meCalls, 0);
    assert.equal(getAuthMode(), "login");
    assert.equal(getAccessToken(), "access-1");
    assert.equal(getRefreshToken(), "refresh-1");
  });

  it("ensureAuthReady throws when credentials are missing", async () => {
    process.env.TAIGA_API_URL = "http://taiga.test/api/v1";
    await assert.rejects(() => ensureAuthReady(), (err: unknown) => {
      assert.ok(err instanceof AuthTaigaError);
      assert.match((err as AuthTaigaError).message, /Missing Taiga credentials/);
      return true;
    });
  });

  it("validateAuthEnv rejects username without password", () => {
    process.env.TAIGA_USERNAME = "admin";
    delete process.env.TAIGA_PASSWORD;
    assert.throws(() => validateAuthEnv(), (err: unknown) => {
      assert.ok(err instanceof AuthTaigaError);
      assert.match((err as AuthTaigaError).message, /TAIGA_PASSWORD is required/);
      return true;
    });
  });

  it("validateAuthEnv rejects password without username", () => {
    delete process.env.TAIGA_USERNAME;
    process.env.TAIGA_PASSWORD = "secret";
    assert.throws(() => validateAuthEnv(), (err: unknown) => {
      assert.ok(err instanceof AuthTaigaError);
      assert.match((err as AuthTaigaError).message, /TAIGA_USERNAME is required/);
      return true;
    });
  });

  it("lazy-seeds access token from TAIGA_TOKEN for getAccessToken", () => {
    process.env.TAIGA_API_URL = "http://taiga.test/api/v1";
    process.env.TAIGA_TOKEN = "lazy-token";
    assert.equal(getAccessToken(), "lazy-token");
  });

  it("refreshAccessToken updates tokens", async () => {
    process.env.TAIGA_API_URL = "http://taiga.test/api/v1";
    setTokensForTests("old-access", "old-refresh");
    mockAuthHttp({ refresh: () => refreshBody });
    await refreshAccessToken();
    assert.equal(getAccessToken(), "access-2");
    assert.equal(getRefreshToken(), "refresh-2");
  });

  it("refreshAccessToken keeps refresh token when response omits refresh", async () => {
    process.env.TAIGA_API_URL = "http://taiga.test/api/v1";
    setTokensForTests("old-access", "keep-refresh");
    mockAuthHttp({
      refresh: () => ({ auth_token: "new-access-only" })
    });
    await refreshAccessToken();
    assert.equal(getAccessToken(), "new-access-only");
    assert.equal(getRefreshToken(), "keep-refresh");
  });

  it("refreshOrReauth re-logins when refresh fails and password is set", async () => {
    process.env.TAIGA_API_URL = "http://taiga.test/api/v1";
    process.env.TAIGA_USERNAME = "admin";
    process.env.TAIGA_PASSWORD = "secret";
    setTokensForTests("stale-access", "stale-refresh");
    let refreshCalls = 0;
    let loginCalls = 0;
    mockAuthHttp({
      refresh: () => {
        refreshCalls++;
        throw new Error("refresh expired");
      },
      login: () => {
        loginCalls++;
        return loginBody;
      }
    });
    await refreshOrReauth();
    assert.equal(refreshCalls, 1);
    assert.equal(loginCalls, 1);
    assert.equal(getAccessToken(), "access-1");
  });

  it("refreshOrReauth deduplicates concurrent refresh calls", async () => {
    process.env.TAIGA_API_URL = "http://taiga.test/api/v1";
    setTokensForTests("stale", "r1");
    let refreshCalls = 0;
    mockAuthHttp({
      refresh: () => {
        refreshCalls++;
        return refreshBody;
      }
    });
    await Promise.all([refreshOrReauth(), refreshOrReauth(), refreshOrReauth()]);
    assert.equal(refreshCalls, 1);
    assert.equal(getAccessToken(), "access-2");
  });

  it("loginWithPassword sends normal auth payload", async () => {
    process.env.TAIGA_API_URL = "http://taiga.test/api/v1";
    let payload: unknown;
    setAuthHttpForTests({
      post: async (_url, data) => {
        payload = data;
        return { data: loginBody };
      },
      get: async () => ({ data: {} })
    });
    await loginWithPassword("admin", "pw");
    assert.deepEqual(payload, {
      type: "normal",
      username: "admin",
      password: "pw"
    });
  });

  it("loginWithPassword wraps axios errors as TaigaError", async () => {
    process.env.TAIGA_API_URL = "http://taiga.test/api/v1";
    setAuthHttpForTests({
      post: async () => {
        throw new AxiosError("Forbidden", undefined, undefined, undefined, {
          status: 403,
          data: { detail: "invalid credentials" }
        } as AxiosError["response"]);
      },
      get: async () => ({ data: {} })
    });
    await assert.rejects(() => loginWithPassword("admin", "wrong"), (err: unknown) => {
      assert.ok(err instanceof AuthTaigaError);
      assert.match((err as AuthTaigaError).message, /Taiga API error \(403\)/);
      assert.match((err as AuthTaigaError).message, /operation=login/);
      return true;
    });
  });
});

describe("getClient / requireConfig", () => {
  beforeEach(() => {
    saveEnv();
    resetClient();
  });

  afterEach(() => {
    resetClient();
    restoreEnv();
  });

  it("throws TaigaError when env vars are missing", () => {
    delete process.env.TAIGA_API_URL;
    delete process.env.TAIGA_TOKEN;
    delete process.env.TAIGA_USERNAME;
    delete process.env.TAIGA_PASSWORD;
    assert.throws(() => getClient(), (err: unknown) => {
      assert.ok(err instanceof TaigaError);
      assert.match((err as TaigaError).message, /Missing Taiga credentials/);
      return true;
    });
  });

  it("throws when only TAIGA_USERNAME is set", () => {
    process.env.TAIGA_API_URL = "http://taiga.test/api/v1";
    process.env.TAIGA_USERNAME = "admin";
    delete process.env.TAIGA_PASSWORD;
    delete process.env.TAIGA_TOKEN;
    assert.throws(() => getClient(), (err: unknown) => {
      assert.ok(err instanceof TaigaError);
      assert.match((err as TaigaError).message, /TAIGA_PASSWORD is required/);
      return true;
    });
  });
});
