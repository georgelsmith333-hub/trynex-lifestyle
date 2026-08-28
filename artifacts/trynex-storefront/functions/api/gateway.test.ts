import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { onRequest } from "./[[path]]";

type GatewayContext = Parameters<typeof onRequest>[0];

function context(method: string, path: string, env: Record<string, string>, body?: string, extraHeaders?: HeadersInit): GatewayContext {
  return {
    request: new Request(`https://trynex-lifestyle-shop.pages.dev/api/${path}`, {
      method,
      body: method === "GET" || method === "HEAD" ? undefined : body,
      headers: body ? { ...extraHeaders, "Content-Type": "application/json" } : extraHeaders,
    }),
    env,
    params: { path: path.split("/") },
    waitUntil: () => undefined,
  } as GatewayContext;
}

describe("three-origin Pages gateway", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("fails safe public reads over to the next origin after a retryable status", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("primary unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ source: "secondary" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await onRequest(context("GET", "products", {
      API_ORIGINS: "https://render-1.example,https://render-2.example,https://render-3.example",
    }));

    expect(response.status).toBe(200);
    expect((await response.json()).source).toBe("secondary");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response.headers.get("X-TryNex-Origin")).toBe("render-2.example");
  });

  it("never replays a mutation to a standby after the primary returns a retryable error", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("primary unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await onRequest(context("POST", "orders", {
      API_ORIGINS: "https://render-1.example,https://render-2.example,https://render-3.example",
    }, JSON.stringify({ customerName: "QA" })));

    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails an authenticated idempotent read over without placing account data in the public cache", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("primary unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await onRequest(context("GET", "admin/stats", {
      API_ORIGINS: "https://render-1.example,https://render-2.example,https://render-3.example",
    }, undefined, { cookie: "session=example" }));

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response.headers.get("X-TryNex-Origin")).toBe("render-2.example");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(new Request(fetchMock.mock.calls[1][0]).headers.get("cookie")).toBe("session=example");
  });

  it("does not replay provider-consuming generation requests even though they use GET", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("primary unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await onRequest(context("GET", "ai/generate", {
      API_ORIGINS: "https://render-1.example,https://render-2.example,https://render-3.example",
    }));

    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.headers.get("X-TryNex-Origin")).toBe("render-1.example");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("skips the suspended primary for public reads so catalogue traffic never probes it", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ source: "standby-2" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await onRequest(context("GET", "products", {}));

    expect(response.status).toBe(200);
    expect((await response.json()).source).toBe("standby-2");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new Request(fetchMock.mock.calls[0][0]).url).toContain("trynex-api-standby-2.onrender.com");
    expect(new Request(fetchMock.mock.calls[0][0]).url).not.toContain("://trynex-api.onrender.com");
  });

  it("still skips the primary when API_ORIGINS lists all three Render hosts", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ source: "standby-2" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await onRequest(context("GET", "products", {
      API_ORIGINS: "https://trynex-api.onrender.com,https://trynex-api-standby-2.onrender.com,https://trynex-api-standby-3.onrender.com",
    }));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new Request(fetchMock.mock.calls[0][0]).url).toContain("trynex-api-standby-2.onrender.com");
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=300");
  });

  it("keeps standbys even when API_ORIGINS only names the suspended primary", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ source: "standby-2" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await onRequest(context("GET", "products", {
      API_ORIGINS: "https://trynex-api.onrender.com",
    }));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new Request(fetchMock.mock.calls[0][0]).url).toContain("trynex-api-standby-2.onrender.com");
  });

  it("keeps standbys even when API_URL only names the suspended primary", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ source: "standby-2" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await onRequest(context("GET", "products", {
      API_URL: "https://trynex-api.onrender.com",
    }));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new Request(fetchMock.mock.calls[0][0]).url).toContain("trynex-api-standby-2.onrender.com");
  });

  it("still pins mutations to the primary writer", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("suspended", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await onRequest(context("POST", "orders", {}, JSON.stringify({ customerName: "QA" })));

    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new Request(fetchMock.mock.calls[0][0]).url).toContain("trynex-api.onrender.com");
  });

  it("fails over public reads from standby-2 to standby-3 without touching the primary", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("standby-2 unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ source: "standby-3" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await onRequest(context("GET", "products", {}));

    expect(response.status).toBe(200);
    expect((await response.json()).source).toBe("standby-3");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new Request(fetchMock.mock.calls[0][0]).url).toContain("trynex-api-standby-2.onrender.com");
    expect(new Request(fetchMock.mock.calls[1][0]).url).toContain("trynex-api-standby-3.onrender.com");
    for (const call of fetchMock.mock.calls) {
      expect(new Request(call[0]).url).not.toContain("://trynex-api.onrender.com/");
    }
  });

  it("answers CORS preflight at the edge without reaching Render", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await onRequest(context("OPTIONS", "products", {
      API_ORIGINS: "https://render-1.example",
    }));

    expect(response.status).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("OPTIONS");
  });
});
