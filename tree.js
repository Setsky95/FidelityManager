// tree.js
import fs from "fs";
import path from "path";

function walk(dir, prefix = "") {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (["node_modules", ".git", "dist", "build"].includes(file)) continue;
    const filepath = path.join(dir, file);
    const stats = fs.statSync(filepath);
    console.log(prefix + "├── " + file);
    if (stats.isDirectory()) {
      walk(filepath, prefix + "│   ");
    }
  }
}

walk(".");
