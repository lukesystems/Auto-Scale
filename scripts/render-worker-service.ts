import { createServer } from "node:http";
import type { IncomingMessage } from "node:http";
import { runRenderWorkerUntilIdle } from "@/services/video-factory/render-worker";

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString("utf8");
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function isAuthorized(authHeader: string | undefined): boolean {
  const secret = process.env.AUTOSCALE_RENDER_WORKER_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  return authHeader === `Bearer ${secret}`;
}

const server = createServer(async (req, res) => {
  try {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.url !== "/run" || req.method !== "POST") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "not_found" }));
      return;
    }

    if (!isAuthorized(req.headers.authorization)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
      return;
    }

    const rawBody = await readBody(req);
    const body = rawBody ? (JSON.parse(rawBody) as { growthRunId?: string; maxBatches?: number }) : {};
    const result = await runRenderWorkerUntilIdle({
      growthRunId: body.growthRunId,
      maxBatches: body.maxBatches,
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, ...result }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      })
    );
  }
});

const port = Number.parseInt(process.env.PORT ?? "8080", 10);
server.listen(port, "0.0.0.0", () => {
  console.log(`[render-worker] listening on :${port}`);
});
