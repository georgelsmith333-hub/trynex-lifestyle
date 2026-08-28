/*
 * Cloudflare Pages Function — route-aware API gateway.
 *
 * Render 1 (trynex-api) is the mutation primary. It is currently skipped for
 * public reads because the Hobby workspace 5 GB outbound cap suspended it.
 * Safe GETs go standby-2 then standby-3. Writes never leave the primary.
 *
 * Origin env vars are merged with the built-in standbys so a lone API_URL
 * cannot disable failover. API_SKIP_ORIGINS / API_WRITE_ORIGIN can override.
 * Standby API services also enforce read-only mode through TRYNEX_RUNTIME_ROLE.
 */

const PRIMARY_ORIGIN = "https://trynex-api.onrender.com";
const STANDBY_ORIGINS = [
  "https://trynex-api-standby-2.onrender.com",
  "https://trynex-api-standby-3.onrender.com",
];
const DEFAULT_ORIGIN = [PRIMARY_ORIGIN, ...STANDBY_ORIGINS].join(",");
const SUSPENDED_READ_HOSTS = new Set(["trynex-api.onrender.com"]);
const REQUEST_TIMEOUT_MS = 6_000;
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

interface GatewayEnv {
  API_URL?: string;
  API_ORIGIN?: string;
  TRYNEX_API_URL?: string;
  API_ORIGINS?: string;
  API_WRITE_ORIGIN?: string;
  API_SKIP_ORIGINS?: string;
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

function collectConfiguredOrigins(env: GatewayEnv): string[] {
  const listed = parseOriginList(env.API_ORIGINS);
  const singles = parseOriginList(env.API_URL || env.API_ORIGIN || env.TRYNEX_API_URL);
  const base = listed.length > 0
    ? listed
    : singles.length > 0
      ? singles
      : parseOriginList(DEFAULT_ORIGIN);
  const hasPrimary = base.some((origin) => hostOf(origin) === "trynex-api.onrender.com");
  const hasStandby = base.some((origin) => hostOf(origin).includes("standby"));
  // A list that only names the suspended primary must still keep the standbys.
  if (hasPrimary && !hasStandby) {
    return parseOriginList([...base, ...STANDBY_ORIGINS].join(","));
  }
  return base;
}

function getWriteOrigins(env: GatewayEnv): string[] {
  const explicit = parseOriginList(env.API_WRITE_ORIGIN);
  if (explicit.length > 0) return explicit;
  const configured = collectConfiguredOrigins(env);
  const primary = configured.find((origin) => hostOf(origin) === "trynex-api.onrender.com");
  return [primary || configured[0]].filter(Boolean);
}

function getReadOrigins(env: GatewayEnv): string[] {
  const configured = collectConfiguredOrigins(env);
  const skipHosts = new Set<string>([
    ...SUSPENDED_READ_HOSTS,
    ...parseOriginList(env.API_SKIP_ORIGINS).map(hostOf),
  ]);
  const live = configured.filter((origin) => !skipHosts.has(hostOf(origin)));
  const standbys = live.filter((origin) => hostOf(origin).includes("standby"));
  const others = live.filter((origin) => !hostOf(origin).includes("standby"));
  const ordered = [...standbys, ...others];
  return ordered.length > 0 ? ordered : configured.slice(0, 1);
}

function isSafePublicRead(method: string, path: string, request: Request): boolean {
  if (method !== "GET" && method !== "HEAD") return false;
  // A browser session cookie does not make an allowlisted catalog/health read
  // a mutation. Authorization-bearing requests remain origin-pinned because
  // they may be user-specific or otherwise unsafe to replay across standbys.
  if (request.headers.get("authorization")) return false;
  return SAFE_PUBLIC_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function corsHeaders(origin: string): Headers {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Idempotency-Key");
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS");
  headers.set("Vary", "Origin");
  return headers;
}

function makeTargetUrl(origin: string, path: string, search: string): URL {
  return new URL(`/api/${path}${search}`, `${origin}/`);
}

export const onRequest: PagesFunction<GatewayEnv> = async (context) => {
  const { request, env, params } = context;
  const originalUrl = new URL(request.url);
  const pathSegments = (params["path"] as string[] | string) ?? [];
  const rawPath = Array.isArray(pathSegments) ? pathSegments.join("/") : pathSegments;
  // The request pathname is authoritative for Pages root catch-all Functions;
  // params.path may be empty or may include the /api prefix depending on the
  // runtime route matcher. Keep params only as a compatibility fallback.
  const pathnamePath = originalUrl.pathname
    .replace(/^\/+/, "")
    .replace(/^api(?:\/|$)/i, "")
    .replace(/^\/+/, "");
  const parameterPath = rawPath.replace(/^\/?api(?:\/|$)/i, "").replace(/^\/+/, "");
  const path = pathnamePath || parameterPath;
  const method = request.method.toUpperCase();
  const apiPath = `/${path}`;
  const safeRead = isSafePublicRead(method, apiPath, request);
  const origin = originalUrl.origin;
  const responseCors = corsHeaders(origin);
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
      return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers: cachedHeaders });
    }
  }

  if (method === "OPTIONS") {
    responseCors.set("Cache-Control", "public, max-age=600");
    return new Response(null, { status: 204, headers: responseCors });
  }

  const candidates = safeRead ? getReadOrigins(env) : getWriteOrigins(env);
  let lastStatus = 503;
  let lastError = "No API origin responded";

  for (const apiOrigin of candidates) {
    const targetUrl = makeTargetUrl(apiOrigin, path, originalUrl.search);
    const headers = new Headers(request.headers);
    headers.set("Host", new URL(apiOrigin).host);
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
      const response = await fetch(proxyRequest, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      lastStatus = response.status;
      if (safeRead && RETRYABLE_STATUSES.has(response.status)) {
        lastError = `Origin ${apiOrigin} returned ${response.status}`;
        continue;
      }

      const responseHeaders = new Headers(response.headers);
      responseCors.forEach((value, key) => responseHeaders.set(key, value));
      responseHeaders.set("X-TryNex-Origin", new URL(apiOrigin).host);
      if (safeRead && response.ok) {
        responseHeaders.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
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
      if (!safeRead) break;
    }
  }

  const failed = new Headers(responseCors);
  failed.set("Content-Type", "application/json");
  failed.set("Cache-Control", "no-store");
  return new Response(
    JSON.stringify({ error: "api_unavailable", message: "The API is temporarily unavailable.", status: lastStatus, detail: lastError }),
    { status: 503, headers: failed },
  );
};
