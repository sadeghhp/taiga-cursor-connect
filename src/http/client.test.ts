import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import {
  resetAuthForTests,
  setAuthHttpForTests,
  setTokensForTests,
  type TaigaAuthResponse
} from "./auth.js";
import {
  attachTaigaInterceptors,
  isAuthEndpoint,
  normalizeRequestPath,
  resetClient
} from "./client.js";

const refreshBody: TaigaAuthResponse = {
  auth_token: "access-2",
  refresh: "refresh-2"
};

describe("isAuthEndpoint", () => {
  const cases: Array<{ url: string; expected: boolean }> = [
    { url: "/users/me", expected: false },
    { url: "/auth", expected: true },
    { url: "http://taiga.test/api/v1/auth/refresh", expected: true },
    { url: "/api/v1/auth/refresh", expected: true },
    { url: "/projects/foo/auth", expected: false },
    { url: "/foo/auth?x=1", expected: false }
  ];

  for (const { url, expected } of cases) {
    it(`${url} → ${expected}`, () => {
      assert.equal(isAuthEndpoint(url), expected);
      assert.equal(normalizeRequestPath(url), normalizeRequestPath(url.split("?")[0] ?? url));
    });
  }
});

describe("401 retry via attachTaigaInterceptors", () => {
  afterEach(() => {
    resetClient();
    delete process.env.TAIGA_API_URL;
  });

  it("refreshes token and retries once on 401", async () => {
    resetAuthForTests();
    process.env.TAIGA_API_URL = "http://taiga.test/api/v1";
    setTokensForTests("stale-access", "stale-refresh");

    let adapterCalls = 0;
    let refreshPosts = 0;

    setAuthHttpForTests({
      post: async (url: string) => {
        if (String(url).endsWith("/auth/refresh")) {
          refreshPosts++;
          return { data: refreshBody };
        }
        throw new Error(`unexpected post ${url}`);
      },
      get: async () => ({ data: {} })
    });

    const adapter = async (
      config: InternalAxiosRequestConfig
    ): Promise<AxiosResponse> => {
      adapterCalls++;
      if (adapterCalls === 1) {
        throw new AxiosError(
          "Unauthorized",
          AxiosError.ERR_BAD_REQUEST,
          config,
          undefined,
          {
            status: 401,
            statusText: "Unauthorized",
            headers: {},
            config,
            data: { detail: "expired" }
          }
        );
      }
      return {
        data: { ok: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config
      };
    };

    const instance = axios.create({
      baseURL: "http://taiga.test/api/v1",
      adapter: adapter as typeof axios.defaults.adapter
    });
    attachTaigaInterceptors(instance);

    const res = await instance.get("/users/me");
    assert.deepEqual(res.data, { ok: true });
    assert.equal(adapterCalls, 2);
    assert.equal(refreshPosts, 1);

    const { getAccessToken } = await import("./auth.js");
    assert.equal(getAccessToken(), "access-2");
  });
});
