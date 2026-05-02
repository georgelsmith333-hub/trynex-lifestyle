/**
 * Cloudflare Pages Function — proxies all /api/* requests to the Cloudflare Worker.
 *
 * Set TRYNEX_API_URL in CF Pages → Settings → Environment Variables to point
 * to your deployed Worker URL, e.g.:
 *   https://trynex-api.<subdomain>.workers.dev
 *
 * The proxy forwards the full path + query string, preserves all request
 * headers, and streams the response body back to the browser.
 */
export async function onRequest({ request, env }) {
  const workerUrl =
    (typeof env !== "undefined" && env.TRYNEX_API_URL) ||
    (typeof TRYNEX_API_URL !== "undefined" && TRYNEX_API_URL) ||
    "";

  if (!workerUrl) {
    return new Response(
      JSON.stringify({ error: "not_configured", message: "API worker URL not configured. Set TRYNEX_API_URL in CF Pages environment variables." }),
      { status: 503, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
    );
  }

  const url = new URL(request.url);
  const base = workerUrl.replace(/\/$/, "");
  const target = `${base}${url.pathname}${url.search}`;

  let body = undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.arrayBuffer();
  }

  const reqHeaders = new Headers(request.headers);
  ["cf-connecting-ip", "cf-ipcountry", "cf-ray", "cf-visitor"].forEach((h) => reqHeaders.delete(h));
  reqHeaders.set("x-forwarded-host", url.hostname);
  reqHeaders.set("x-proxied-via", "cf-pages");

  let resp;
  try {
    resp = await fetch(target, {
      method: request.method,
      headers: reqHeaders,
      body,
      redirect: "follow",
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "proxy_error", message: "API worker unavailable", detail: String(err) }),
      { status: 503, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
    );
  }

  const resHeaders = new Headers(resp.headers);
  resHeaders.delete("transfer-encoding");
  resHeaders.delete("connection");
  resHeaders.set("x-proxied-by", "cf-pages-function");

  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: resHeaders,
  });
}
