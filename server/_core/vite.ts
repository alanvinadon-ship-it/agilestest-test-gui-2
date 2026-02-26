import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import path from "path";

/**
 * setupVite — only called in development (NODE_ENV=development).
 * All vite-related imports are fully dynamic so esbuild never bundles them.
 */
export async function setupVite(app: Express, server: Server) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const viteModule = await (Function('return import("vite")')() as Promise<typeof import("vite")>);
  const { nanoid } = await (Function('return import("nanoid")')() as Promise<typeof import("nanoid")>);

  // Load vite.config.ts at runtime via dynamic import
  const viteConfigPath = path.resolve(import.meta.dirname, "../..", "vite.config.ts");
  const viteConfigModule = await viteModule.loadConfigFromFile(
    { command: "serve", mode: "development" },
    viteConfigPath
  );

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await viteModule.createServer({
    ...(viteConfigModule?.config ?? {}),
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
