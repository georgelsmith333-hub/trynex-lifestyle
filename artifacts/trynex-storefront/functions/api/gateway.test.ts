import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { onRequest } from "./[[path]]";

type GatewayContext = Parameters<typeof onRequest>[0];

function context(method: string, path: string, env: Record<string, string>, body?: string): GatewayContext {
  return {
    request: new Request(`https://trynex-lifestyle-shop.pages.dev/api/${path}`, {
      method,
      body: method === "GET" || method === "HEAD" ? undefined : body,
      headers: body ? { "Content-Type": "application/json" } : undefined,
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
