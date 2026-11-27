import fs from "node:fs";
import path from "node:path";
import { createReadStream } from "node:fs";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".gz": "application/gzip",
  ".map": "application/json; charset=utf-8"
};

const DENIED_TOP_LEVEL = new Set([
  "server",
  "test",
  "tests",
  "data",
  "node_modules",
  "package.json",
  "package-lock.json",
  ".env",
  ".env.example",
  ".git",
  ".gitignore",
  "README.md",
  "DEPLOY.md"
]);

export function isDeniedPath(relativePath) {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized) return false;
  const parts = normalized.split("/");
  if (parts.some((part) => part.startsWith("."))) return true;
  return DENIED_TOP_LEVEL.has(parts[0]);
}

export function resolveStaticPath(root, pathname) {
  if (pathname === "/" || pathname === "") return { file: path.join(root, "index.html"), relative: "index.html" };
  if (pathname === "/admin" || pathname === "/admin/") {
    return { file: path.join(root, "admin.html"), relative: "admin.html" };
  }
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const relative = decoded.replace(/^\/+/, "");
  if (!relative || isDeniedPath(relative)) return null;
  const file = path.resolve(root, relative);
  const rootResolved = path.resolve(root);
  if (file !== rootResolved && !file.startsWith(rootResolved + path.sep)) return null;
  return { file, relative };
}

function cacheControl(relative) {
  if (relative.endsWith(".html")) return "no-cache";
  // Auth/admin entry points and the service worker must revalidate so a deploy cannot strand users on a stale gate.
  if (
    relative === "sw.js" ||
    relative === "account.js" ||
    relative === "account.css" ||
    relative === "admin.js" ||
    relative === "admin.css"
  ) {
    return "no-cache";
  }
  if (relative.startsWith("audio/") || relative.startsWith("fonts/") || relative.startsWith("icons/") || relative.startsWith("vendor/")) {
    return "public, max-age=86400";
  }
  if (relative.endsWith(".js") || relative.endsWith(".css") || relative.endsWith(".json")) {
    return "public, max-age=3600";
  }
  return "public, max-age=3600";
}

function parseRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header || "").trim());
  if (!match) return null;
  let start = match[1] === "" ? null : Number(match[1]);
  let end = match[2] === "" ? null : Number(match[2]);
  if (start === null && end === null) return null;
  if (start === null) {
    start = Math.max(0, size - end);
    end = size - 1;
  } else if (end === null || end >= size) {
    end = size - 1;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= size) return null;
  return { start, end };
}

export async function serveStatic(req, res, pathname, root) {
  const resolved = resolveStaticPath(root, pathname);
  if (!resolved) return false;

  let stat;
  try {
    stat = await fs.promises.stat(resolved.file);
  } catch {
    return false;
  }
  if (!stat.isFile()) return false;

  const ext = path.extname(resolved.file).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;

  const headers = {
    "Content-Type": type,
    "Cache-Control": cacheControl(resolved.relative),
    ETag: etag,
    "Last-Modified": stat.mtime.toUTCString(),
    "Accept-Ranges": "bytes"
  };
  if (resolved.relative === "admin.html") {
    headers["Content-Security-Policy"] =
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
  }

  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304, headers);
    res.end();
    return true;
  }

  const range = parseRange(req.headers.range, stat.size);
  if (req.headers.range && !range) {
    res.writeHead(416, { ...headers, "Content-Range": `bytes */${stat.size}` });
    res.end();
    return true;
  }

  if (range) {
    headers["Content-Range"] = `bytes ${range.start}-${range.end}/${stat.size}`;
    headers["Content-Length"] = String(range.end - range.start + 1);
    res.writeHead(206, headers);
    if (req.method === "HEAD") {
      res.end();
      return true;
    }
    createReadStream(resolved.file, { start: range.start, end: range.end }).pipe(res);
    return true;
  }

  headers["Content-Length"] = String(stat.size);
  res.writeHead(200, headers);
  if (req.method === "HEAD") {
    res.end();
    return true;
  }
  createReadStream(resolved.file).pipe(res);
  return true;
}
