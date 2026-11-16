/**
 * scripts/serve-test-pages.js
 *
 * Serves the fake scam and safe pages in test-pages/ at http://localhost:5180
 * so the AI threat scanner can be tried on them. No dependencies.
 *
 * Usage:  npm run test-pages
 */
import { createServer } from "http";
import { readFile } from "fs/promises";
import { extname, join, normalize, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "test-pages");
const PORT = 5180;
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css" };

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
  const file = join(ROOT, path === "/" || path === "\\" ? "index.html" : path);
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(PORT, () => {
  console.log(`Sentinel test pages: http://localhost:${PORT}`);
});
