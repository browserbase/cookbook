/**
 * Simple static file server for the mock portals.
 * Serves the bank portal and treasury portal HTML files on localhost:3000.
 *
 * Usage: npx tsx serve.ts
 */

import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const MOCK_DIR = path.resolve(__dirname, "mock-sites");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  let filePath = path.join(MOCK_DIR, url.pathname);

  // Default to index
  if (url.pathname === "/") {
    filePath = path.join(MOCK_DIR, "bank-portal.html");
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end(`
        <html>
          <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h2>the cookbook example Treasury Demo — Mock Portals</h2>
            <p>Available portals:</p>
            <ul style="list-style: none; padding: 0;">
              <li><a href="/bank-portal.html">🏦 Global Trust Bank Portal</a></li>
              <li><a href="/treasury-portal.html">📊 the cookbook example Treasury Management System</a></li>
            </ul>
          </body>
        </html>
      `);
      return;
    }

    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n🌐 Mock portals running at http://localhost:${PORT}`);
  console.log(
    `   🏦 Bank Portal:    http://localhost:${PORT}/bank-portal.html`,
  );
  console.log(
    `   📊 Treasury TMS:   http://localhost:${PORT}/treasury-portal.html`,
  );
  console.log(`\n   Press Ctrl+C to stop.\n`);
});
