// server/index.ts
import express, { type Request, Response, NextFunction } from "express";
import type { AddressInfo } from "net";
import registerRoutes from "./routes.mts";
import { setupVite, serveStatic, log } from "./vite";
import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";

const app = express();

["GMAIL_USER", "GMAIL_PASS", "PORT"].forEach((k) => {
  if (!process.env[k]) console.warn(`[ENV] Falta ${k}`);
});

// ===== Middlewares base =====

// CORS para el front de Vite (dev)
app.use(
  cors({
    origin: ["http://127.0.0.1:5173", "http://localhost:5173"],
    credentials: true,
  })
);

// Cookies (para JWT en futuras rutas)
app.use(cookieParser());

// Body parsers (subido el límite por templates HTML)
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// tiny request id (útil para depurar)
app.use((req, _res, next) => {
  (req as any).rid = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  next();
});

// Logger para /api/*
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;

  const originalResJson = res.json.bind(res);
  res.json = function (bodyJson: any, ...args: any[]) {
    capturedJsonResponse = bodyJson;
    return originalResJson(bodyJson, ...args);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `[${(req as any).rid}] ${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        try {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        } catch {
          /* no-op */
        }
      }
      if (logLine.length > 80) logLine = logLine.slice(0, 79) + "…";
      log(logLine);
    }
  });

  next();
});

// Healthcheck
app.get("/api/healthz", (_req, res) => {
  res.status(200).json({ ok: true, ts: new Date().toISOString() });
});

// ===== Bootstrap =====
(async () => {
  // Registra rutas de la app (emails, automations, auth, etc.)
  await registerRoutes(app);

  // Manejador de errores (después de registrar rutas)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err?.status || err?.statusCode || 500;
    const message = err?.message || "Internal Server Error";
    res.status(status).json({ message });
    // relanzamos para que quede en logs del proceso
    throw err;
  });

  // Vite sólo en dev (sirve el front con HMR). En prod, archivos estáticos.
  if (app.get("env") === "development") {
    await setupVite(app, app); // segundo arg no crítico en tu helper
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT ?? 5000);
  const isWin = process.platform === "win32";
  const host = process.env.HOST ?? (isWin ? "127.0.0.1" : "0.0.0.0");

  // Intento de escucha con fallback si el puerto está en uso
  const listen = async (p: number) =>
    await new Promise<import("http").Server>((resolve, reject) => {
      const server = app
        .listen({ port: p, host }, () => resolve(server))
        .on("error", reject);
    });

  try {
    const server = await listen(port);
    const addr = server.address() as AddressInfo;
    log(`serving on http://${addr.address}:${addr.port}`);
  } catch (err: any) {
    if (err?.code === "EADDRINUSE") {
      const alt = port + 1;
      const server = await listen(alt);
      const addr = server.address() as AddressInfo;
      log(`port ${port} in use. now serving on http://${addr.address}:${addr.port}`);
    } else {
      console.error(err);
      process.exit(1);
    }
  }

  // Cierre limpio
  const graceful = async (signal: string) => {
    try {
      log(`received ${signal}, shutting down…`);
      // Express no tiene close global aquí, pero si guardás el server arriba podrías cerrarlo.
      process.exit(0);
    } catch (e) {
      console.error("error on shutdown:", e);
      process.exit(1);
    }
  };
  process.on("SIGINT", () => graceful("SIGINT"));
  process.on("SIGTERM", () => graceful("SIGTERM"));
  process.on("unhandledRejection", (r) => console.error("unhandledRejection:", r));
  process.on("uncaughtException", (e) => {
    console.error("uncaughtException:", e);
    process.exit(1);
  });
})();
