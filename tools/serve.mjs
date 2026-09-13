#!/usr/bin/env node
// Servidor estático de Wardern SIN caché, equivalente en Node de serve.py.
// Existe porque no todas las máquinas de desarrollo tienen Python instalado.
//   node tools/serve.mjs [--port 8099]
import http from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const i = process.argv.indexOf("--port");
const PORT = i === -1 ? 8099 : Number(process.argv[i + 1]);

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const servidor = http.createServer(async (req, res) => {
  const sinQuery = decodeURIComponent(req.url.split("?")[0]);
  // Resolver dentro de ROOT: bloquea ../ y rutas absolutas.
  const destino = path.join(ROOT, path.normalize(sinQuery).replace(/^(\.\.[/\\])+/, ""));
  if (!destino.startsWith(ROOT)) {
    res.writeHead(403).end("403");
    return;
  }

  let archivo = destino;
  try {
    if ((await stat(archivo)).isDirectory()) archivo = path.join(archivo, "index.html");
    await stat(archivo);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("404");
    return;
  }

  res.writeHead(200, {
    "Content-Type": TIPOS[path.extname(archivo).toLowerCase()] ?? "application/octet-stream",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  });
  createReadStream(archivo).pipe(res);
});

servidor.listen(PORT, () => console.log(`Wardern en http://localhost:${PORT}`));
