import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

const server = createServer((req, res) => {
  if (req.url === "/" || req.url === "/index.html") {
    const html = readFileSync(join(__dirname, "portal.html"), "utf-8");
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(
    `\n🌐 AccuPay vendor portal running at http://localhost:${PORT}\n`,
  );
});
