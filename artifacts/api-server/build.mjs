import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(artifactDir, "../..");

// Plugin that resolves @workspace/* imports to their actual TS source so esbuild can bundle them.
const workspacePlugin = {
  name: "bundle-workspace",
  setup(build) {
    build.onResolve({ filter: /^@workspace\// }, (args) => {
      const pkgShortName = args.path.replace("@workspace/", "");
      // Workspace packages live under lib/<name>
      const candidates = [
        path.resolve(workspaceRoot, "lib", pkgShortName),
        path.resolve(workspaceRoot, "artifacts", pkgShortName),
      ];
      for (const dir of candidates) {
        if (!existsSync(dir)) continue;
        try {
          const pkg = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"));
          const mainExport = pkg.exports?.["."] ?? pkg.main;
          if (mainExport) {
            return { path: path.resolve(dir, mainExport) };
          }
        } catch {
          // skip
        }
      }
      return null;
    });
  },
};

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    // Externalize all npm packages (loaded from node_modules at runtime).
    // Workspace packages are re-included via the workspacePlugin above.
    packages: "external",
    external: ["*.node"],
    sourcemap: "linked",
    plugins: [
      workspacePlugin,
      esbuildPluginPino({ transports: ["pino-pretty"] }),
    ],
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
