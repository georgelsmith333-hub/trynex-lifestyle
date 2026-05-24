/**
 * Cloudflare Pages Function — Catchall middleware
 *
 * Handles two special cases before falling through to static assets / SPA:
 *
 * 1. Google Search Console HTML-file verification:
 *    Any request to /google*.html is served as a GSC verification response.
 *    Set GOOGLE_SITE_VERIFICATION in CF Pages env vars (the code shown in
 *    Google Search Console when you choose "HTML file" verification).
 *
 * 2. Everything else passes through via context.next() so static files and
 *    the SPA fallback (_redirects) work as normal.
 *
 * NOTE: functions/api/[[route]].js has a more specific path and takes
 * precedence for all /api/* requests — no conflict.
 */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // ── Google Search Console HTML-file verification ──────────────────────────
  if (/^\/google[a-zA-Z0-9_-]+\.html$/.test(path)) {
    const code = (env.GOOGLE_SITE_VERIFICATION || "").trim();
    if (code) {
      return new Response(`google-site-verification: ${code}`, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=86400",
          "X-Robots-Tag": "noindex",
        },
      });
    }
  }

  // ── Pass everything else to static assets / SPA fallback ─────────────────
  return context.next();
}
