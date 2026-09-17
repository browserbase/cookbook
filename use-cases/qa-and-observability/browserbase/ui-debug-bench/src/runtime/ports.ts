import { createServer } from "node:net";

const reservedPorts = new Set<number>();

export async function findOpenPort(start = 6700, count = 1000): Promise<number> {
  const offset = Math.floor(Math.random() * count);
  for (let i = 0; i < count; i += 1) {
    const port = start + ((offset + i) % count);
    if (reservedPorts.has(port)) continue;
    if (await isOpen(port)) {
      reservedPorts.add(port);
      return port;
    }
  }
  throw new Error(`No open localhost port found in range ${start}-${start + count - 1}`);
}

function isOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}
