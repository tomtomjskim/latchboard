import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { extname, join, normalize, resolve, sep } from "node:path";
import type { TodaySnapshot, WorkstreamSummary } from "../shared/contracts";

type LatchboardServerOptions = {
  host: "127.0.0.1";
  port: number;
  token: string;
  getSnapshot: () => TodaySnapshot;
};

export type LatchboardServer = {
  url: string;
  close: () => Promise<void>;
};

function isAuthorized(request: IncomingMessage, token: string): boolean {
  return request.headers.authorization === `Bearer ${token}`;
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function writeText(response: ServerResponse, statusCode: number, body: string): void {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(body);
}

function contentType(path: string): string {
  const types: Record<string, string> = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8"
  };
  return types[extname(path)] ?? "application/octet-stream";
}

function rootHtml(token: string): string {
  const bootstrap = JSON.stringify({ token });
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Latchboard</title>
  </head>
  <body>
    <main id="root">Latchboard</main>
    <script>window.__LATCHBOARD_BOOTSTRAP__=${bootstrap};</script>
  </body>
</html>`;
}

function builtRootHtml(token: string): string | null {
  const indexPath = resolve("dist/ui/index.html");
  if (!existsSync(indexPath)) {
    return null;
  }

  const bootstrapScript = `<script>window.__LATCHBOARD_BOOTSTRAP__=${JSON.stringify({ token })};</script>`;
  const html = readFileSync(indexPath, "utf8");
  return html.includes("</body>")
    ? html.replace("</body>", `${bootstrapScript}</body>`)
    : `${html}${bootstrapScript}`;
}

function staticAssetPath(pathname: string): string | null {
  if (!pathname.startsWith("/assets/")) {
    return null;
  }

  const distRoot = resolve("dist/ui");
  const assetPath = normalize(join(distRoot, pathname));
  if (!assetPath.startsWith(`${distRoot}${sep}`)) {
    return null;
  }
  return assetPath;
}

function serveBuiltAsset(response: ServerResponse, pathname: string): boolean {
  const assetPath = staticAssetPath(pathname);
  if (!assetPath || !existsSync(assetPath)) {
    return false;
  }

  response.writeHead(200, {
    "Content-Type": contentType(assetPath),
    "Cache-Control": "no-store"
  });
  response.end(readFileSync(assetPath));
  return true;
}

function workstreamById(snapshot: TodaySnapshot, id: string): WorkstreamSummary | undefined {
  return snapshot.workstreams.find((workstream) => workstream.workstreamId === id);
}

function routeApi(
  request: IncomingMessage,
  response: ServerResponse,
  options: LatchboardServerOptions,
  pathname: string
): void {
  if (!isAuthorized(request, options.token)) {
    writeText(response, 401, "Unauthorized");
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    writeText(response, 405, "Method Not Allowed");
    return;
  }

  if (pathname === "/api/snapshot") {
    writeJson(response, 200, options.getSnapshot());
    return;
  }

  if (pathname.startsWith("/api/workstreams/")) {
    let id: string;
    try {
      id = decodeURIComponent(pathname.slice("/api/workstreams/".length));
    } catch {
      writeText(response, 400, "Bad Request");
      return;
    }

    const workstream = workstreamById(options.getSnapshot(), id);
    if (!workstream) {
      writeText(response, 404, "Not Found");
      return;
    }
    writeJson(response, 200, workstream);
    return;
  }

  if (pathname === "/api/stream") {
    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive"
    });
    response.write(`event: snapshot\n`);
    response.write(`data: ${JSON.stringify(options.getSnapshot())}\n\n`);
    response.write(`event: heartbeat\n`);
    response.write(`data: {"ok":true}\n\n`);
    return;
  }

  writeText(response, 404, "Not Found");
}

export async function createLatchboardServer(options: LatchboardServerOptions): Promise<LatchboardServer> {
  if (options.host !== "127.0.0.1") {
    throw new Error("Latchboard server must bind to 127.0.0.1");
  }

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://${options.host}`);
    if (url.pathname.startsWith("/api/")) {
      routeApi(request, response, options, url.pathname);
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      writeText(response, 405, "Method Not Allowed");
      return;
    }

    if (serveBuiltAsset(response, url.pathname)) {
      return;
    }

    const html = builtRootHtml(options.token) ?? rootHtml(options.token);
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    });
    response.end(html);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address() as AddressInfo;
  return {
    url: `http://${options.host}:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      })
  };
}
