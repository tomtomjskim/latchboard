import { createServer } from "node:http";

const host = "127.0.0.1";
const port = Number.parseInt(process.env.LATCHBOARD_PORT ?? "8787", 10);

const server = createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Method Not Allowed");
    return;
  }

  response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Latchboard server scaffold ready\n");
});

server.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`Latchboard server scaffold ready at http://${host}:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      process.exit(0);
    });
  });
}
