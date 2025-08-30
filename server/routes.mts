// server/routes.mts
import type { Express, Request, Response, NextFunction } from "express";
import { adminDb } from "./firebase";
import { Timestamp } from "firebase-admin/firestore";
import type { AutomationsSettingsFile } from "../shared/schema";
import fs from "node:fs/promises";
import path from "node:path";
// ⛽️ Email (Gmail via Nodemailer)
import { transporter, sendEmail } from "./email.js";
// 🔐 Password hashing + JWT
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const AUTOMATIONS_FILE =
  process.env.AUTOMATIONS_FILE_PATH || path.join(process.cwd(), "automations.JSON");

// -----------------------------
// Helpers
// -----------------------------
function renderTemplate(tpl: string, vars: Record<string, any>) {
  return (tpl || "").replace(/\{\{(\w+)\}\}/g, (_m, k) =>
    (vars?.[k] ?? "").toString()
  );
}

async function readAutomationsFile(): Promise<any> {
  try {
    const raw = await fs.readFile(AUTOMATIONS_FILE, "utf-8");
    const text = raw.replace(/^\uFEFF/, "");
    return text.trim() ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

type SessionUser = {
  id: string;
  numero: number;
  email: string;
  nombre: string;
  apellido: string;
  puntos: number;
};

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";

function signSession(u: SessionUser) {
  return jwt.sign(u, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function cookieOpts() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd,  // en prod por HTTPS
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 días
  };
}

// middleware opcional (para proteger rutas admin si querés)
function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = (req as any).cookies?.vg_session as string | undefined;
    if (!raw) return res.status(401).json({ ok: false, error: "No auth" });
    const payload = jwt.verify(raw, JWT_SECRET) as SessionUser;
    (res as any).locals.user = payload;
    next();
  } catch {
    return res.status(401).json({ ok: false, error: "Sesión inválida" });
  }
}

/**
 * Busca una plantilla por clave:
 * 1) Firestore: settings/automations
 * 2) Archivo automations.JSON
 * 3) Fallback mínimo
 */
async function getTemplateByKey(
  key: string
): Promise<{ from: string; subject: string; body: string; enabled?: boolean }> {
  // 1) Firestore
  try {
    const ref = adminDb.doc("settings/automations");
    const snap = await ref.get();
    if (snap.exists) {
      const data: any = snap.data() || {};
      const candidate = data[key] || data[`${key}Email`];
      if (candidate?.subject || candidate?.body) {
        return {
          from: candidate.from || `"Van Gogh Fidelidad" <${process.env.GMAIL_USER}>`,
          subject: candidate.subject || "",
          body: candidate.body || "",
          enabled: candidate.enabled,
        };
      }
    }
  } catch (e) {
    console.warn("[getTemplateByKey] Firestore fallo:", e);
  }

  // 2) Archivo
  const fileData = await readAutomationsFile();
  const candidate = fileData[key] || fileData[`${key}Email`];
  if (candidate?.subject || candidate?.body) {
    return {
      from: candidate.from || `"Van Gogh Fidelidad" <${process.env.GMAIL_USER}>`,
      subject: candidate.subject || "",
      body: candidate.body || "",
      enabled: candidate.enabled,
    };
  }

  // 3) Fallback mínimo
  return {
    from: `"Van Gogh Fidelidad" <${process.env.GMAIL_USER}>`,
    subject: `Notificación: ${key}`,
    body: `<div>Hola {{nombre}}, este es un mensaje de ${key}.</div>`,
    enabled: true,
  };
}

/**
 * Registro de rutas de la API
 */
export default async function registerRoutes(app: Express) {
  /* =========================================================
   *  PUBLIC: /api/public/register
   *  - Alta de socio (Sumate)
   *  - Evita duplicados por email
   *  - Guarda passwordHash (bcrypt)
   *  - Dispara email de bienvenida
   * ======================================================= */
  app.post("/api/public/register", async (req, res) => {
    try {
      const { nombre, apellido, email, password } = req.body ?? {};
      if (
        !nombre || typeof nombre !== "string" || !nombre.trim() ||
        !apellido || typeof apellido !== "string" || !apellido.trim() ||
        !email || typeof email !== "string" || !email.includes("@") ||
        !password || typeof password !== "string" || password.length < 8 || password.length > 72
      ) {
        return res.status(400).json({ ok: false, error: "Datos inválidos" });
      }

      const clean = {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        email: email.trim().toLowerCase(),
      };

      // 🔎 evitar duplicados por email
      const dup = await adminDb
        .collection("suscriptores")
        .where("email", "==", clean.email)
        .limit(1)
        .get();
      if (!dup.empty) {
        return res.status(409).json({ ok: false, error: "El email ya está registrado" });
      }

      // 🔐 hash
      const passwordHash = await bcrypt.hash(password, 12);

      const result = await adminDb.runTransaction(async (tx) => {
        // 1) Secuencia
        const seqRef = adminDb.doc("meta/sequences");
        const seqSnap = await tx.get(seqRef);
        const current = seqSnap.exists ? Number(seqSnap.data()?.membersNext || 1) : 1;
        const next = current + 1;
        tx.set(seqRef, { membersNext: next }, { merge: true });

        // 2) Socio
        const numero = current;
        const id = `VG${numero}`;
        const now = Timestamp.now();
        const memberRef = adminDb.doc(`suscriptores/${id}`);

        tx.set(memberRef, {
          id,
          numero,
          nombre: clean.nombre,
          apellido: clean.apellido,
          email: clean.email,
          puntos: 0,
          passwordHash, // 👈 nunca guardar plaintext
          fechaRegistro: now,
          ultimaActualizacion: now,
          ultimoMotivo: "Registro público",
        });

        // 3) Log "create"
        const movRef = adminDb.collection("movimientos").doc();
        tx.set(movRef, {
          memberId: id,
          memberIdNumber: numero,
          memberName: `${clean.nombre} ${clean.apellido}`.trim(),
          email: clean.email,
          type: "create",
          delta: 0,
          previousPoints: 0,
          newPoints: 0,
          reason: "Registro público",
          createdAt: now,
        });

        return { id, numero, nombre: clean.nombre, apellido: clean.apellido, email: clean.email };
      });

      // 🔔 Email de bienvenida (no bloqueante)
      try {
        const tpl = await getTemplateByKey("welcome");
        if (tpl.enabled !== false) {
          const data = {
            nombre: result.nombre,
            apellido: result.apellido,
            email: result.email,
            id: result.id,
            puntos: 0,
            delta: 0,
          };
          const subject = renderTemplate(tpl.subject, data);
          const html = renderTemplate(tpl.body, data);
          await sendEmail({ to: result.email, subject, html, from: tpl.from });
        }
      } catch (e) {
        console.warn("[welcome email] fallo no bloqueante:", e);
      }

      return res.status(201).json({ ok: true, member: result });
    } catch (e: any) {
      console.error("[/api/public/register] error:", e);
      return res.status(500).json({ ok: false, error: e?.message || "Error al registrar" });
    }
  });

  /* =========================================================
   *  AUTH: login / me / logout
   * ======================================================= */
  app.post("/api/public/login", async (req, res) => {
    try {
      const { email, password } = req.body ?? {};
      if (
        !email || typeof email !== "string" || !email.includes("@") ||
        !password || typeof password !== "string"
      ) {
        return res.status(400).json({ ok: false, error: "Datos inválidos" });
      }
      const emailLc = email.trim().toLowerCase();

      const q = await adminDb
        .collection("suscriptores")
        .where("email", "==", emailLc)
        .limit(1)
        .get();

      if (q.empty) return res.status(401).json({ ok: false, error: "Credenciales inválidas" });

      const doc = q.docs[0];
      const data = doc.data() as any;

      if (!data?.passwordHash) {
        return res.status(401).json({ ok: false, error: "Credenciales inválidas" });
      }

      const ok = await bcrypt.compare(password, data.passwordHash);
      if (!ok) return res.status(401).json({ ok: false, error: "Credenciales inválidas" });

      const user: SessionUser = {
        id: data.id,
        numero: Number(data.numero),
        email: data.email,
        nombre: data.nombre,
        apellido: data.apellido,
        puntos: Number(data.puntos || 0),
      };

      const token = signSession(user);
      res.cookie("vg_session", token, cookieOpts());
      return res.json({ ok: true, user });
    } catch (e: any) {
      console.error("[/api/public/login] error:", e);
      return res.status(500).json({ ok: false, error: e?.message || "Error en login" });
    }
  });

  app.get("/api/auth/me", (req, res) => {
    try {
      const raw = (req as any).cookies?.vg_session as string | undefined;
      if (!raw) return res.status(401).json({ ok: false, error: "No auth" });
      const user = jwt.verify(raw, JWT_SECRET) as SessionUser;
      return res.json({ ok: true, user });
    } catch {
      return res.status(401).json({ ok: false, error: "Sesión inválida" });
    }
  });

  app.post("/api/auth/logout", (_req, res) => {
    res.cookie("vg_session", "", { ...cookieOpts(), maxAge: 0 });
    return res.json({ ok: true });
  });

  /* =========================================================
   *  AUTOMATIONS en Firestore (opcional)
   * ======================================================= */
  app.get("/api/automations/settings", async (_req, res) => {
    try {
      const ref = adminDb.doc("settings/automations");
      const snap = await ref.get();
      res.json({ ok: true, data: snap.exists ? snap.data() : {} });
    } catch (e: any) {
      console.error("[GET /api/automations/settings]", e);
      res.status(500).json({ ok: false, error: e?.message || "Error al leer automations" });
    }
  });

  app.put("/api/automations/settings", async (req, res) => {
    try {
      const body = req.body as AutomationsSettingsFile;
      if (!body || typeof body !== "object") throw new Error("Payload inválido");

      const ref = adminDb.doc("settings/automations");
      await ref.set(body, { merge: true });

      res.json({ ok: true });
    } catch (e: any) {
      console.error("[PUT /api/automations/settings]", e);
      res.status(400).json({ ok: false, error: e?.message || "No se pudo guardar" });
    }
  });

  /* =========================================================
   *  AUTOMATIONS en archivo automations.JSON
   * ======================================================= */
  app.get("/api/automations", async (_req, res) => {
    try {
      const data = await readAutomationsFile();
      res.status(200).json(data);
    } catch (e: any) {
      console.error("[GET /api/automations] error:", e);
      res.status(500).json({ message: e?.message || "Error leyendo automations.JSON" });
    }
  });

  app.post("/api/automations", async (req, res) => {
    try {
      const body = req.body;
      if (!body || typeof body !== "object") {
        return res.status(400).json({ message: "Payload inválido" });
      }
      const json = JSON.stringify(body, null, 2);
      await fs.writeFile(AUTOMATIONS_FILE, json, { encoding: "utf-8" });
      res.status(200).json(body);
    } catch (e: any) {
      console.error("[POST /api/automations] error:", e);
      res.status(500).json({ message: e?.message || "Error guardando automations.JSON" });
    }
  });

  /* =========================================================
   *  EMAIL via Gmail (verify + test mínimo)
   * ======================================================= */
  app.get("/api/email/verify", async (_req, res) => {
    try {
      await transporter.verify();
      res.json({ ok: true, msg: "SMTP listo 👌" });
    } catch (e: any) {
      console.error("[email.verify] error:", e);
      res.status(500).json({ ok: false, error: e?.message, code: e?.code, response: e?.response });
    }
  });

  app.post("/api/email/test", async (req, res) => {
    try {
      const { to } = req.body ?? {};
      if (!to) return res.status(400).json({ ok: false, error: 'Falta "to"' });

      const info = await sendEmail({
        to,
        subject: "Prueba — Van Gogh Fidelidad",
        html: "<div>Funciona 💥</div>",
      });

      res.json({ ok: true, messageId: info.messageId });
    } catch (e: any) {
      console.error("[email.test] error:", e);
      res.status(500).json({
        ok: false,
        error: e?.message,
        code: e?.code,
        command: e?.command,
        response: e?.response,
      });
    }
  });

  /* =========================================================
   *  AUTOMATIONS reales (welcome + points-add)
   * ======================================================= */
  app.post("/api/automations/welcome", async (req, res) => {
    try {
      const { to, data, key, template } = req.body ?? {};
      if (!to) return res.status(400).json({ ok: false, error: 'Falta "to"' });

      const tpl = template ?? (await getTemplateByKey(key || "welcome"));
      if (tpl.enabled === false) return res.status(400).json({ ok: false, error: "Template deshabilitado" });

      const subject = renderTemplate(tpl.subject, data || {});
      const html = renderTemplate(tpl.body, data || {});

      const info = await sendEmail({ to, subject, html, from: tpl.from });
      res.json({ ok: true, messageId: info.messageId });
    } catch (e: any) {
      console.error("[automations.welcome] error:", e);
      res.status(500).json({ ok: false, error: e?.message, response: e?.response });
    }
  });

  app.post("/api/automations/points-add", async (req, res) => {
    try {
      const { to, data, key, template } = req.body ?? {};
      if (!to) return res.status(400).json({ ok: false, error: 'Falta "to"' });

      const tpl = template ?? (await getTemplateByKey(key || "pointsAdd"));
      if (tpl.enabled === false) return res.status(400).json({ ok: false, error: "Template deshabilitado" });

      const subject = renderTemplate(tpl.subject, data || {});
      const html = renderTemplate(tpl.body, data || {});

      const info = await sendEmail({ to, subject, html, from: tpl.from });
      res.json({ ok: true, messageId: info.messageId });
    } catch (e: any) {
      console.error("[automations.points-add] error:", e);
      res.status(500).json({ ok: false, error: e?.message, response: e?.response });
    }
  });

  // === TEST DE AUTOMATION DESDE LA UI ===
  app.post("/api/automations/test-email", async (req, res) => {
    try {
      const { to, template, key, data } = req.body ?? {};
      if (!to) return res.status(400).json({ ok: false, error: 'Falta "to"' });

      const tpl = template && (template.subject || template.body)
        ? {
            from: template.from || `"Van Gogh Fidelidad" <${process.env.GMAIL_USER}>`,
            subject: String(template.subject || ""),
            body: String(template.body || ""),
            enabled: true,
          }
        : await getTemplateByKey(key || "welcome");

      if (tpl.enabled === false) {
        return res.status(400).json({ ok: false, error: "Template deshabilitado" });
      }

      const sample: Record<string, any> = {
        nombre: "Seba",
        apellido: "Pavlotsky",
        email: to,
        id: "VG999",
        puntos: 123,
        delta: 45,
        threshold: 200,
      };
      const ctx = { ...sample, ...(data || {}) };

      const subject = renderTemplate(tpl.subject || "Test automation", ctx);
      const html = renderTemplate(tpl.body || "<p>Hola {{nombre}}, este es un test.</p>", ctx);

      const info = await sendEmail({ to, subject, html, from: tpl.from });
      return res.json({ ok: true, messageId: info.messageId });
    } catch (e: any) {
      console.error("[automations.test-email] error:", e);
      return res.status(500).json({ ok: false, error: e?.message, response: e?.response });
    }
  });

  // === ADMIN: crear socio (opcionalmente con puntos y/o password) ===
  app.post("/api/admin/members", /*requireAuth,*/ async (req, res) => {
    try {
      const { nombre, apellido, email, puntos, password } = req.body ?? {};
      if (
        !nombre || typeof nombre !== "string" || !nombre.trim() ||
        !apellido || typeof apellido !== "string" || !apellido.trim() ||
        !email || typeof email !== "string" || !email.includes("@")
      ) {
        return res.status(400).json({ ok: false, error: "Datos inválidos" });
      }

      const clean = {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        email: email.trim().toLowerCase(),
        puntos: Math.max(0, Number(puntos || 0)),
      };

      // evitar duplicado admin
      const dup = await adminDb
        .collection("suscriptores")
        .where("email", "==", clean.email)
        .limit(1)
        .get();
      if (!dup.empty) {
        return res.status(409).json({ ok: false, error: "El email ya está registrado" });
      }

      const maybeHash =
        typeof password === "string" && password.length >= 8 && password.length <= 72
          ? await bcrypt.hash(password, 12)
          : undefined;

      const result = await adminDb.runTransaction(async (tx) => {
        // secuencia
        const seqRef = adminDb.doc("meta/sequences");
        const seqSnap = await tx.get(seqRef);
        const current = seqSnap.exists ? Number(seqSnap.data()?.membersNext || 1) : 1;
        const next = current + 1;
        tx.set(seqRef, { membersNext: next }, { merge: true });

        // crear socio
        const numero = current;
        const id = `VG${numero}`;
        const now = Timestamp.now();
        const memberRef = adminDb.doc(`suscriptores/${id}`);

        const baseDoc: any = {
          id,
          numero,
          nombre: clean.nombre,
          apellido: clean.apellido,
          email: clean.email,
          puntos: clean.puntos,
          fechaRegistro: now,
          ultimaActualizacion: now,
          ultimoMotivo: "Alta admin",
        };
        if (maybeHash) baseDoc.passwordHash = maybeHash;

        tx.set(memberRef, baseDoc);

        // log de creación
        const movCreateRef = adminDb.collection("movimientos").doc();
        tx.set(movCreateRef, {
          memberId: id,
          memberIdNumber: numero,
          memberName: `${clean.nombre} ${clean.apellido}`.trim(),
          email: clean.email,
          type: "create",
          delta: 0,
          previousPoints: 0,
          newPoints: clean.puntos,
          reason: "Alta admin",
          createdAt: now,
        });

        // si hay puntos iniciales, log adicional
        if (clean.puntos > 0) {
          const movAddRef = adminDb.collection("movimientos").doc();
          tx.set(movAddRef, {
            memberId: id,
            memberIdNumber: numero,
            memberName: `${clean.nombre} ${clean.apellido}`.trim(),
            email: clean.email,
            type: "add",
            delta: clean.puntos,
            previousPoints: 0,
            newPoints: clean.puntos,
            reason: "Puntos iniciales (alta admin)",
            createdAt: now,
          });
        }

        return { id, numero, nombre: clean.nombre, apellido: clean.apellido, email: clean.email, puntos: clean.puntos };
      });

      // welcome
      try {
        const tpl = await getTemplateByKey("welcome");
        if (tpl.enabled !== false) {
          const data = {
            nombre: result.nombre,
            apellido: result.apellido,
            email: result.email,
            id: result.id,
            puntos: result.puntos,
            delta: 0,
          };
          const subject = renderTemplate(tpl.subject, data);
          const html = renderTemplate(tpl.body, data);
          await sendEmail({ to: result.email, subject, html, from: tpl.from });
        }
      } catch (e) {
        console.warn("[admin welcome] fallo no bloqueante:", e);
      }

      // pointsAdd si hubo puntos iniciales
      if (result.puntos > 0) {
        try {
          const tpl = await getTemplateByKey("pointsAdd");
          if (tpl.enabled !== false) {
            const data = {
              nombre: result.nombre,
              apellido: result.apellido,
              email: result.email,
              id: result.id,
              puntos: result.puntos,
              delta: result.puntos,
            };
            const subject = renderTemplate(tpl.subject, data);
            const html = renderTemplate(tpl.body, data);
            await sendEmail({ to: result.email, subject, html, from: tpl.from });
          }
        } catch (e) {
          console.warn("[admin points-add email] fallo no bloqueante:", e);
        }
      }

      return res.status(201).json({ ok: true, member: result });
    } catch (e: any) {
      console.error("[/api/admin/members] error:", e);
      return res.status(500).json({ ok: false, error: e?.message || "Error al crear socio (admin)" });
    }
  });

  /* =========================================================
   *  Fallback JSON para /api
   * ======================================================= */
  app.use("/api", (_req, res) => {
    res.status(404).json({ ok: false, error: "Not found" });
  });

  return app;
}
