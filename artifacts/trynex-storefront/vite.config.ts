import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

const port = Number(process.env.PORT ?? "5173");
const basePath = process.env.BASE_PATH ?? "/";
const apiPort = process.env.API_PORT ?? "8080";

function patchAdminMockupsModule(code: string): string {
  let out = code;
  out = out.replace(
    'import { useState, useRef, useCallback } from "react";',
    'import { useState, useEffect, useRef, useCallback } from "react";'
  );
  out = out.replace(
    'import { getAuthHeaders } from "@/lib/utils";',
    'import { getAuthHeaders, getApiUrl } from "@/lib/utils";'
  );
  out = out.replace('const API = import.meta.env.VITE_API_URL ?? "";\n\n', '');
  out = out.replace('fetch(`${API}${path}`, {', 'fetch(getApiUrl(path), {');
  out = out.replace('headers: { "Content-Type": "application/json", ...getAuthHeaders(), ...(opts.headers ?? {}) },', 'headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", ...getAuthHeaders(), ...(opts.headers ?? {}) },');
  out = out.replace('`${API}/api/storage/public-objects/${objectPath}`', 'getApiUrl(`/api/storage/public-objects/${objectPath}`)');
  out = out.replace('useState(() => { fetchMockups(); });', 'useEffect(() => { fetchMockups(); }, [fetchMockups]);');
  return out;
}

const trynexRuntimeHotfixes = {
  name: "trynex:runtime-hotfixes",
  enforce: "pre" as const,
  transform(code: string, id: string) {
    if (id.replace(/\\/g, "/").endsWith("/src/pages/admin/AdminMockups.tsx")) {
      return { code: patchAdminMockupsModule(code), map: null };
    }
    return null;
  },
};

/**
 * Cloudflare Rocket Loader rewrites every `<script>` it sees, including
 * `<script type="module">`, replacing the `type` attribute with a synthetic
 * value like `type="b1323df6...module"`. The browser then refuses to execute
 * the script, the React bundle never boots, and the page stays a blank white
 * screen — particularly on mobile, where the timing race is much harder to
 * win than on desktop.
 *
 * The supported escape hatch is to mark each script with `data-cfasync="false"`,
 * which tells Rocket Loader to leave it alone. We inject the attribute into
 * every <script> tag in the built index.html (and on the dev server) so we
 * don't depend on the Cloudflare dashboard setting being correct.
 */
function addCfAsyncFalse(html: string): string {
  const COMMENT_RE = /<!--[\s\S]*?-->/g;
  const parts: { isComment: boolean; text: string }[] = [];
  let lastIdx = 0;
  for (const m of html.matchAll(COMMENT_RE)) {
    if (m.index! > lastIdx) parts.push({ isComment: false, text: html.slice(lastIdx, m.index!) });
    parts.push({ isComment: true, text: m[0] });
    lastIdx = m.index! + m[0].length;
  }
  if (lastIdx < html.length) parts.push({ isComment: false, text: html.slice(lastIdx) });
  const TAG_RE = /<script(?=[\s>/])(?![^>]*\bdata-cfasync\b)/gi;
  return parts
    .map((p) => (p.isComment ? p.text : p.text.replace(TAG_RE, '<script data-cfasync="false"')))
    .join("");
}

function injectBuildMeta(html: string): string {
  const hash = process.env.VITE_BUILD_HASH || new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  let out = html.replace(
    /<meta name="theme-color"/,
    `<meta name="build" content="${hash}" />\n    <meta name="theme-color"`
  );
  if (!out.includes('/mobile-fixes.css')) {
    out = out.replace(
      /<\/head>/,
      `    <link rel="stylesheet" href="/mobile-fixes.css" />\n  </head>`
    );
  }
  return out;
}

const cfDisableRocketLoader = {
  name: "trynex:disable-cf-rocket-loader",
  transformIndexHtml: {
    order: "post" as const,
    handler(html: string): string {
      return addCfAsyncFalse(injectBuildMeta(html));
    },
  },
  async closeBundle() {
    try {
      const fs = await import("node:fs/promises");
      const outFile = path.resolve(import.meta.dirname, "dist/index.html");
      const html = await fs.readFile(outFile, "utf8");
      const patched = addCfAsyncFalse(injectBuildMeta(html));
      if (patched !== html) await fs.writeFile(outFile, patched, "utf8");
    } catch {
      // dist/index.html doesn't exist in dev mode.
    }
  },
};

export default defineConfig({
  base: basePath,
  plugins: [
    trynexRuntimeHotfixes,
    react(),
    tailwindcss(),
    cfDisableRocketLoader,
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: false,
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        globIgnores: ["**/mockups/**"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        additionalManifestEntries: [{ url: "/offline.html", revision: null }],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom", "@tanstack/react-query"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-motion": ["framer-motion"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-tabs",
            "@radix-ui/react-select",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-toast",
            "@radix-ui/react-popover",
          ],
          "vendor-editor": ["@tiptap/react", "@tiptap/starter-kit"],
          "vendor-charts": ["recharts"],
          "vendor-3d": ["three", "@react-three/fiber", "@react-three/drei"],
        },
      },
    },
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.removeHeader("origin");
            proxyReq.removeHeader("referer");
          });
        },
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});