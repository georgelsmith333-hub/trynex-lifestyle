/**
 * Cloudflare Pages Function — API proxy
 *
 * Intercepts all /api/* requests on the Cloudflare Pages frontend and
 * forwards them to the Render-hosted API server. This avoids cross-origin
 * issues (the frontend is on trynexshop.com, the API is on Render) and
 * prevents the SPA fallback rule in _redirects from returning index.html
 * for API calls, which was causing "Unexpected token '<'" JSON parse errors.
 *
 * Required env var (set in CF Pages dashboard → Settings → Environment variables):
 *   API_ORIGIN  — the base URL of the API server, e.g. https://trynex-api.onrender.com
 *                 (no trailing slash)
 *
 * Fallback: if API_ORIGIN is not set the function returns a 503 so the
 * frontend shows a clear error instead of the HTML SPA fallback.
 */
export async function onRequest(context) {
  const { request, env, params } = context;

  const apiOrigin = (env.API_ORIGIN || "").replace(/\/+$/, "");

  if (!apiOrigin) {
    return new Response(
      JSON.stringify({ error: "API_ORIGIN env var is not configured in Cloudflare Pages" }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  }

  // Reconstruct the target URL: replace the CF Pages origin with the API origin.
  const url = new URL(request.url);
  const targetUrl = `${apiOrigin}${url.pathname}${url.search}`;

  // Forward the request, stripping the CF-specific headers that the origin
  // doesn't need and adding a Via header so the API can identify proxied calls.
  const proxyReq = new Request(targetUrl, {
    method: request.method,
    headers: (() => {
      const h = new Headers(request.headers);
      // Prevent Cloudflare from sending its own host to the backend
      h.set("Host", new URL(apiOrigin).host);
      h.set("X-Forwarded-Host", url.host);
      h.set("X-Via", "cf-pages-proxy");
      return h;
    })(),
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    redirect: "follow",
  });

  try {
    const response = await fetch(proxyReq);

    // Pass response back to the browser, adding CORS headers in case the
    // Cloudflare dashboard CORS settings aren't enabled.
    const respHeaders = new Headers(response.headers);
    respHeaders.set("Cache-Control", "no-store");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: respHeaders,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "API proxy error", detail: String(err) }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
