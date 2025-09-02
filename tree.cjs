#!/usr/bin/env node
/**
 * tree.js — Árbol de directorios sin dependencias
 * Uso básico:
 *   node tree.js                 # árbol completo (omite node_modules, .git, etc.)
 *   node tree.js --all           # incluye ocultos (.*)
 *   node tree.js --depth 3       # limita profundidad
 *   node tree.js --dir ./client  # cambia el directorio raíz
 *   node tree.js --size          # muestra tamaños de archivos
 *   node tree.js --ignore dist,.next,coverage  # ignora carpetas extra (coma-sep)
 *   node tree.js --color         # colorcitos
 *
 * Volcado a archivo:
 *   node tree.js > estructura.txt
 */

const fs = require("fs");
const path = require("path");

const args = new Map(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) {
      const key = cur.replace(/^--/, "");
      const next = arr[i + 1];
      if (!next || next.startsWith("--")) acc.push([key, true]);
      else acc.push([key, next]);
    }
    return acc;
  }, [])
);

const rootDir = path.resolve(args.get("dir") || ".");
const showAll = Boolean(args.get("all"));
const maxDepth = args.has("depth") ? Number(args.get("depth")) : Infinity;
const showSize = Boolean(args.get("size"));
const useColor = Boolean(args.get("color"));

const defaultIgnores = [
  "node_modules",
  ".git",
  ".next",
  ".turbo",
  ".vercel",
  "dist",
  "build",
  "coverage",
  ".cache",
  ".DS_Store"
];

const extraIgnores = (args.get("ignore") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ignoreSet = new Set([...defaultIgnores, ...extraIgnores]);

const SYM = {
  tee: "├── ",
  elbow: "└── ",
  pipe: "│   ",
  space: "    ",
  dir: useColor ? "\x1b[36m" : "", // cyan
  file: useColor ? "\x1b[37m" : "", // white
  reset: useColor ? "\x1b[0m" : ""
};

function formatSize(bytes) {
  if (!showSize) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let b = Number(bytes);
  let u = 0;
  while (b >= 1024 && u < units.length - 1) {
    b /= 1024;
    u++;
  }
  return ` (${b % 1 === 0 ? b : b.toFixed(1)}${units[u]})`;
}

async function safeLstat(p) {
  try {
    return await fs.promises.lstat(p);
  } catch {
    return null;
  }
}

async function listDir(dir) {
  try {
    return await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function shouldSkip(name) {
  if (ignoreSet.has(name)) return true;
  if (!showAll && name.startsWith(".")) return true;
  return false;
}

async function printTree(dir, prefix = "", depth = 0) {
  if (depth > maxDepth) return;

  let entries = await listDir(dir);

  // Filtrar ignorados
  entries = entries.filter((e) => !shouldSkip(e.name));

  // Ordenar: dirs primero, luego archivos, ambos alfabéticamente
  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
  });

  const lastIndex = entries.length - 1;

  for (let i = 0; i < entries.length; i++) {
    const ent = entries[i];
    const isLast = i === lastIndex;
    const connector = isLast ? SYM.elbow : SYM.tee;
    const full = path.join(dir, ent.name);
    const stats = await safeLstat(full);

    if (!stats) continue;

    if (ent.isDirectory()) {
      const line =
        prefix +
        connector +
        SYM.dir +
        ent.name +
        "/" +
        SYM.reset +
        (showSize ? formatSize(stats.size) : "");
      console.log(line);
      await printTree(full, prefix + (isLast ? SYM.space : SYM.pipe), depth + 1);
    } else if (ent.isSymbolicLink && typeof ent.isSymbolicLink === "function" && ent.isSymbolicLink()) {
      console.log(
        prefix + connector + SYM.file + ent.name + SYM.reset + " -> (symlink)" + formatSize(stats.size)
      );
    } else {
      console.log(prefix + connector + SYM.file + ent.name + SYM.reset + formatSize(stats.size));
    }
  }
}

(async () => {
  const rootStats = await safeLstat(rootDir);
  if (!rootStats) {
    console.error(`No se puede acceder a: ${rootDir}`);
    process.exit(1);
  }

  const rootName = path.basename(rootDir);
  const header =
    (useColor ? "\x1b[33m" : "") + rootName + "/" + SYM.reset; // amarillo para header
  console.log(header);
  await printTree(rootDir, "", 1);
})();
