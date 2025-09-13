// server/app.ts
import express from "express";
import type { Request, Response, NextFunction } from "express";
import registerRoutes from "./routes.mts";

const app = express();

// Middlewares básicos de tu index.ts
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Request id simple
app.use((req, _res, next) => {
  (req as any).rid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  next();
});

// Logger corto para /api
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let captured: any;

  const orig = res.json.bind(res);
  res.json = function (body: any, ...args: any[]) {
    captured = body;
    return orig(body, ...args);
  };
 
  res.on("finish", () => {
    const ms = Date.now() - start;
    if (path.startsWith("/api")) {
      let line = `[${(req as any).rid}] ${req.method} ${path} ${res.statusCode} in ${ms}ms`;
      if (captured) {
        try { line += ` :: ${JSON.stringify(captured)}`; } catch {}
      }
      if (line.length > 80) line = line.slice(0,79) + "…";
      console.log(line);
    }
  });

  next();
});

// Health
app.get("/api/healthz", (_req, res) => res.status(200).json({ ok: true, ts: new Date().toISOString() }));

// Rutas reales
await registerRoutes(app);

export default app;
