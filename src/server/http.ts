import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { extname, join, normalize, resolve, sep } from "node:path";
import type { TodaySnapshot, WorkstreamSummary } from "../shared/contracts";

type LatchboardServerOptions = {
  host: "127.0.0.1";
  port: number;
  token: string;
  getSnapshot: () => TodaySnapshot;
  registerSafeLabel?: (workstreamId: string, safeTitle: string) => TodaySnapshot;
  subscribeToSnapshots?: (listener: (snapshot: TodaySnapshot) => void) => () => void;
  staticRoot?: string;
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

function bootstrapScript(token: string, snapshot: TodaySnapshot): string {
  const bootstrap = JSON.stringify({ token, snapshot }).replace(/</g, "\\u003c");
  return `<script>window.__LATCHBOARD_BOOTSTRAP__=${bootstrap};</script>`;
}

function rootHtml(token: string, snapshot: TodaySnapshot): string {
  const bootstrap = bootstrapScript(token, snapshot);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Latchboard</title>
  </head>
  <body>
    <main id="root">Latchboard</main>
    ${bootstrap}
  </body>
</html>`;
}

function builtRootHtml(token: string, snapshot: TodaySnapshot, staticRoot: string): string | null {
  const indexPath = resolve(staticRoot, "index.html");
  if (!existsSync(indexPath)) {
    return null;
  }

  const bootstrap = bootstrapScript(token, snapshot);
  const html = readFileSync(indexPath, "utf8");
  return html.includes("</body>")
    ? html.replace("</body>", `${bootstrap}</body>`)
    : `${html}${bootstrap}`;
}

function staticAssetPath(pathname: string, staticRoot: string): string | null {
  if (!pathname.startsWith("/assets/")) {
    return null;
  }

  const distRoot = resolve(staticRoot);
  const assetsRoot = resolve(distRoot, "assets");
  const assetPath = normalize(join(distRoot, pathname));
  if (!assetPath.startsWith(`${assetsRoot}${sep}`)) {
    return null;
  }

  try {
    const assetStat = lstatSync(assetPath);
    if (!assetStat.isFile()) {
      return null;
    }

    const realDistRoot = realpathSync(distRoot);
    const realAssetPath = realpathSync(assetPath);
    if (!realAssetPath.startsWith(`${realDistRoot}${sep}`)) {
      return null;
    }
  } catch {
    return null;
  }

  return assetPath;
}

function serveBuiltAsset(response: ServerResponse, pathname: string, staticRoot: string): boolean {
  const assetPath = staticAssetPath(pathname, staticRoot);
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

function labelRouteId(pathname: string): string | null {
  const prefix = "/api/workstreams/";
  const suffix = "/label";
  return pathname.startsWith(prefix) && pathname.endsWith(suffix)
    ? pathname.slice(prefix.length, -suffix.length)
    : null;
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 4096) {
      throw new Error("request body too large");
    }
  }

  return body ? JSON.parse(body) : {};
}

function isLabelPayload(value: unknown): value is { safeTitle: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { safeTitle?: unknown }).safeTitle === "string" &&
    (value as { safeTitle: string }).safeTitle.trim().length > 0
  );
}

async function routeApi(
  request: IncomingMessage,
  response: ServerResponse,
  options: LatchboardServerOptions,
  pathname: string
): Promise<void> {
  if (!isAuthorized(request, options.token)) {
    writeText(response, 401, "Unauthorized");
    return;
  }

  const rawLabelId = labelRouteId(pathname);
  if (rawLabelId !== null) {
    if (request.method !== "POST") {
      writeText(response, 405, "Method Not Allowed");
      return;
    }
    if (!options.registerSafeLabel) {
      writeText(response, 409, "Label registration unavailable");
      return;
    }

    let id: string;
    try {
      id = decodeURIComponent(rawLabelId);
    } catch {
      writeText(response, 400, "Bad Request");
      return;
    }

    if (!workstreamById(options.getSnapshot(), id)) {
      writeText(response, 404, "Not Found");
      return;
    }

    let body: unknown;
    try {
      body = await readJsonBody(request);
    } catch {
      writeText(response, 400, "Bad Request");
      return;
    }

    if (!isLabelPayload(body)) {
      writeText(response, 400, "Bad Request");
      return;
    }

    try {
      const snapshot = options.registerSafeLabel(id, body.safeTitle);
      writeJson(response, 200, { snapshot });
    } catch {
      writeText(response, 400, "Bad Request");
    }
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
    const unsubscribe = options.subscribeToSnapshots?.((snapshot) => {
      response.write(`event: snapshot_updated\n`);
      response.write(`data: ${JSON.stringify(snapshot)}\n\n`);
    });
    request.on("close", () => {
      unsubscribe?.();
      response.end();
    });
    return;
  }

  writeText(response, 404, "Not Found");
}

export async function createLatchboardServer(options: LatchboardServerOptions): Promise<LatchboardServer> {
  if (options.host !== "127.0.0.1") {
    throw new Error("Latchboard server must bind to 127.0.0.1");
  }
  const staticRoot = resolve(options.staticRoot ?? "dist/ui");

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://${options.host}`);
    if (url.pathname.startsWith("/api/")) {
      void routeApi(request, response, options, url.pathname).catch(() => {
        if (!response.headersSent) {
          writeText(response, 500, "Internal Server Error");
        } else {
          response.end();
        }
      });
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      writeText(response, 405, "Method Not Allowed");
      return;
    }

    if (serveBuiltAsset(response, url.pathname, staticRoot)) {
      return;
    }

    if (url.pathname.startsWith("/assets/")) {
      writeText(response, 404, "Not Found");
      return;
    }

    const snapshot = options.getSnapshot();
    const html = builtRootHtml(options.token, snapshot, staticRoot) ?? rootHtml(options.token, snapshot);
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
