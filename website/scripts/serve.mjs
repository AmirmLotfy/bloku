import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../dist",
);
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};
const localePaths = new Set(["ar", "es", "pt-br", "fr", "de", "ja", "hi"]);
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://localhost:${port}`);
      const pathname = decodeURIComponent(url.pathname);
      if (pathname.includes("..") || pathname.includes("\\")) {
        res.writeHead(400);
        res.end("Bad request");
        return;
      }
      if (pathname.length > 1 && pathname.endsWith("/")) {
        res.writeHead(308, { Location: pathname.slice(0, -1) + url.search });
        res.end();
        return;
      }
      const bare = path.join(root, pathname);
      const candidates =
        pathname === "/"
          ? [path.join(root, "index.html")]
          : [bare, `${bare}.html`, path.join(bare, "index.html")];
      for (const file of candidates) {
        try {
          if (!(await fs.stat(file)).isFile()) continue;
          const content = await fs.readFile(file);
          res.writeHead(200, {
            "Content-Type":
              types[path.extname(file)] || "application/octet-stream",
            "X-Content-Type-Options": "nosniff",
          });
          res.end(req.method === "HEAD" ? undefined : content);
          return;
        } catch (error) {
          if (!["ENOENT", "ENOTDIR"].includes(error.code)) throw error;
        }
      }
      const locale = pathname.split("/")[1];
      const notFound = path.join(
        root,
        localePaths.has(locale) ? `${locale}/404.html` : "404.html",
      );
      res.writeHead(404, { "Content-Type": types[".html"] });
      res.end(req.method === "HEAD" ? undefined : await fs.readFile(notFound));
    } catch {
      res.writeHead(500);
      res.end("Server error");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`BLOKU preview: http://127.0.0.1:${port}`),
  );
