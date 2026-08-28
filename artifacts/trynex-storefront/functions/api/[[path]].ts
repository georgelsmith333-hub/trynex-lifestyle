/*
 * Cloudflare Pages Function — route-aware API gateway.
 *
 * Canonical writer: Render 2 (trynex-api-standby-2).
 * Safe reads: R2 then R3. Writes never round-robin and never auto-promote.
 * Render 1 (trynex-api) is recovery-only: skipped unless API_RECOVERY_ENABLED=true
 * (reads) or API_WRITE_ORIGIN explicitly names it (writes).
 *
 * HTML 200 from a cold-start Render splash page is treated as retryable on reads.
 * Mutations are attempted once against the current writer, with Idempotency-Key
 * forwarded so the API can safely replay.
 */

const RECOVERY_ORIGIN = "https://trynex-api.onrender.com";
const CANONICAL_WRITER = "https://trynex-api-standby-2.onrender.com";
const DR_ORIGIN = "https://trynex-api-standby-3.onrender.com";
const DEFAULT_READ_ORIGINS = [CANONICAL_WRITER, DR_ORIGIN, RECOVERY_ORIGIN].join(",");
const READ_TIMEOUT_MS = 12_000;
const WRITE_TIMEOUT_MS = 20_000;
const RETRYABLE_STATUSES = new Set([502, 503, 504]);
const SAFE_PUBLIC_PREFIXES = [
  "/products",
  "/categories",
  "/mockups",
  "/public-stats",
  "/blog",
  "/testimonials",
  "/settings",
  "/health",
  "/healthz",
  "/readyz",
];
const PRIMARY_ONLY_READ_PREFIXES = ["/ai/generate"];

interface GatewayEnv {
  API_URL?: string;
  API_ORIGIN?: string;
  TRYNEX_API_URL?: string;
  API_ORIGINS?: string;
  API_WRITE_ORIGIN?: string;
  API_SKIP_ORIGINS?: string;
  API_RECOVERY_ENABLED?: string;
}

function parseOriginList(raw: string | undefined): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(",").map((value) => value.trim().replace(/\/$/, "")).filter(Boolean))];
}

function hostOf(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}

function recoveryReadsEnabled(env: GatewayEnv): boolean {
  return env.API_RECOVERY_ENABLED === "true";
}

function collectConfiguredOrigins(env: GatewayEnv): string[] {
  const listed = parseOriginList(env.API_ORIGINS);
  const singles = parseOriginList(env.API_URL || env.API_ORIGIN || env.TRYNEX_API_URL);
  const base = listed.length > 0
    ? listed
    : singles.length > 0
      ? singles
      : parseOriginList(DEFAULT_READ_ORIGINS);
  const hasRecovery = base.some((origin) => hostOf(origin) === hostOf(RECOVERY_ORIGIN));
  const hasStandby = base.some((origin) => {
    const host = hostOf(origin);
    return host === hostOf(CANONICAL_WRITER) || host === hostOf(DR_ORIGIN) || host.includes("standby");
  });
  // A list that only names the suspended recovery origin must still keep R2/R3.
  if (hasRecovery && !hasStandby) {
    return parseOriginList([...base, CANONICAL_WRITER, DR_ORIGIN].join(","));
  }
  return base;
}

function getWriteOrigins(env: GatewayEnv): string[] {
  const explicit = parseOriginList(env.API_WRITE_ORIGIN);
  if (explicit.length > 0) return [explicit[0]];
  return [CANONICAL_WRITER];
}

function getReadOrigins(env: GatewayEnv): string[] {
  const skipHosts = new Set<string>(parseOriginList(env.API_SKIP_ORIGINS).map(hostOf));
  if (!recoveryReadsEnabled(env)) skipHosts.add(hostOf(RECOVERY_ORIGIN));
  const configured = collectConfiguredOrigins(env);
  const live = configured.filter((origin) => !skipHosts.has(hostOf(origin)));
  const writer = live.filter((origin) => hostOf(origin) === hostOf(CANONICAL_WRITER));
  const dr = live.filter((origin) => hostOf(origin) === hostOf(DR_ORIGIN));
  const others = live.filter((origin) => {
    const host = hostOf(origin);
    return host !== hostOf(CANONICAL_WRITER) && host !== hostOf(DR_ORIGIN);
  });
  const ordered = [...writer, ...dr, ...others];
  return ordered.length > 0 ? ordered : [CANONICAL_WRITER];
}

function isSafePublicRead(method: string, path: string, request: Request): boolean {
  if (method !== "GET" && method !== "HEAD") return false;
  if (request.headers.get("authorization")) return false;
  return SAFE_PUBLIC_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function isIdempotentRead(method: string): boolean {
  return method === "GET" || method === "HEAD";
}

function canFailOverRead(method: string, path: string): boolean {
  if (!isIdempotentRead(method)) return false;
  return !PRIMARY_ONLY_READ_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function corsHeaders(origin: string): Headers {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Idempotency-Key, X-Request-Id, X-Correlation-Id");
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS");
  headers.set("Access-Control-Expose-Headers", "X-TryNex-Origin, X-TryNex-Edge-Cache, X-Correlation-Id, X-Request-Id");
  headers.set("Vary", "Origin");
  return headers;
}

function makeTargetUrl(origin: string, path: string, search: string): URL {
  return new URL(`/api/${path}${search}`, `${origin}/`);
}

function ensureCorrelationId(request: Request): string {
  const incoming = request.headers.get("x-correlation-id") || request.headers.get("x-request-id");
  if (incoming && incoming.trim()) return incoming.trim().slice(0, 128);
  return crypto.randomUUID();
}

function isRetryableOriginResponse(response: Response, failover: boolean): boolean {
  if (!failover) return false;
  if (RETRYABLE_STATUSES.has(response.status)) return true;
  if (!response.ok) return false;
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  return contentType.includes("text/html");
}

async function discardBody(response: Response): Promise<void> {
  try {
    if (response.body && typeof response.body.cancel === "function") {
      await response.body.cancel();
      return;
    }
    await response.arrayBuffer();
  } catch {
    // Best-effort drain so the origin socket is not held open.
  }
}

export const onRequest: PagesFunction<GatewayEnv> = async (context) => {
  const { request, env, params } = context;
  const originalUrl = new URL(request.url);
  const pathSegments = (params["path"] as string[] | string) ?? [];
  const rawPath = Array.isArray(pathSegments) ? pathSegments.join("/") : pathSegments;
  const pathnamePath = originalUrl.pathname
    .replace(/^\/+/, "")
    .replace(/^api(?:\/|$)/i, "")
    .replace(/^\/+/, "");
  const parameterPath = rawPath.replace(/^\/?api(?:\/|$)/i, "").replace(/^\/+/, "");
  const path = pathnamePath || parameterPath;
  const method = request.method.toUpperCase();
  const apiPath = `/${path}`;
  const safeRead = isSafePublicRead(method, apiPath, request);
  const idempotentRead = isIdempotentRead(method);
  const failoverRead = canFailOverRead(method, apiPath);
  const origin = originalUrl.origin;
  const responseCors = corsHeaders(origin);
  const correlationId = ensureCorrelationId(request);
  const edgeCache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const cacheable = safeRead
    && method === "GET"
    && !request.headers.get("cookie")
    && !originalUrl.searchParams.has("search");
  const cacheKeyUrl = new URL(originalUrl.toString());
  cacheKeyUrl.searchParams.set("_trynex_origin", origin);
  const cacheKey = new Request(cacheKeyUrl.toString(), { method: "GET" });

  if (cacheable && edgeCache) {
    const cached = await edgeCache.match(cacheKey);
    if (cached) {
      const cachedHeaders = new Headers(cached.headers);
      responseCors.forEach((value, key) => cachedHeaders.set(key, value));
      cachedHeaders.set("X-TryNex-Edge-Cache", "HIT");
      cachedHeaders.set("X-Correlation-Id", correlationId);
      cachedHeaders.set("X-Request-Id", correlationId);
      return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers: cachedHeaders });
    }
  }

  if (method === "OPTIONS") {
    responseCors.set("Cache-Control", "public, max-age=600");
    responseCors.set("X-Correlation-Id", correlationId);
    responseCors.set("X-Request-Id", correlationId);
    return new Response(null, { status: 204, headers: responseCors });
  }

  const candidates = failoverRead ? getReadOrigins(env) : getWriteOrigins(env);
  const timeoutMs = failoverRead ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS;
  let lastStatus = 503;
  let lastError = "No API origin responded";

  for (const apiOrigin of candidates) {
    const targetUrl = makeTargetUrl(apiOrigin, path, originalUrl.search);
    const headers = new Headers(request.headers);
    headers.set("Host", new URL(apiOrigin).host);
    headers.set("X-Correlation-Id", correlationId);
    headers.set("X-Request-Id", correlationId);
    headers.delete("origin");
    headers.delete("referer");
    if (safeRead) headers.delete("cookie");

    const requestInit: RequestInit & { duplex?: "half" } = {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : request.body,
      redirect: "follow",
    };
    if (requestInit.body) requestInit.duplex = "half";
    const proxyRequest = new Request(targetUrl.toString(), requestInit);

    try {
      const response = await fetch(proxyRequest, { signal: AbortSignal.timeout(timeoutMs) });
      lastStatus = response.status;
      if (isRetryableOriginResponse(response, failoverRead)) {
        lastError = `Origin ${apiOrigin} returned ${response.status} ${response.headers.get("content-type") || ""}`.trim();
        await discardBody(response);
        continue;
      }

      const responseHeaders = new Headers(response.headers);
      responseCors.forEach((value, key) => responseHeaders.set(key, value));
      responseHeaders.set("X-TryNex-Origin", new URL(apiOrigin).host);
      responseHeaders.set("X-Correlation-Id", correlationId);
      responseHeaders.set("X-Request-Id", correlationId);
      if (safeRead && response.ok) {
        responseHeaders.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
      }
      if (idempotentRead && !safeRead) {
        responseHeaders.set("Cache-Control", "private, no-store");
      }

      if (cacheable && edgeCache && response.ok) {
        responseHeaders.set("X-TryNex-Edge-Cache", "MISS");
      }
      const output = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
      if (cacheable && edgeCache && response.ok) {
        const waitUntil = (context as unknown as { waitUntil?: (promise: Promise<unknown>) => void }).waitUntil;
        const cacheCopy = output.clone();
        const write = edgeCache.put(cacheKey, cacheCopy).catch(() => undefined);
        if (waitUntil) waitUntil(write);
        else await write;
      }
      return output;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (!failoverRead) break;
    }
  }

  const failed = new Headers(responseCors);
  failed.set("Content-Type", "application/json");
  failed.set("Cache-Control", "no-store");
  failed.set("X-Correlation-Id", correlationId);
  failed.set("X-Request-Id", correlationId);
  return new Response(
    JSON.stringify({ error: "api_unavailable", message: "The API is temporarily unavailable.", status: lastStatus, detail: lastError, correlationId }),
    { status: 503, headers: failed },
  );
};
