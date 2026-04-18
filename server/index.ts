import "dotenv/config";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import gpuRoutes from "./routes/gpus.js";
import providerRoutes from "./routes/providers.js";
import snapshotRoutes from "./routes/snapshot.js";
import healthRoutes from "./routes/health.js";
import v1Routes from "./routes/v1.js";
import { startPoller } from "./poller.js";

const PORT = Number(process.env.PORT ?? 3001);
const CRON_EXPR = process.env.POLL_CRON ?? "*/5 * * * *";

const app = Fastify({ logger: false });

app.addHook("onSend", async (_req, reply, payload) => {
  reply.header("cache-control", "no-store");
  return payload;
});

// CORS — open to all origins. This is a free public read-only API.
app.addHook("onRequest", async (_req, reply) => {
  reply.header("access-control-allow-origin", "*");
  reply.header("access-control-allow-methods", "GET, POST, OPTIONS");
  reply.header("access-control-allow-headers", "content-type, accept");
  reply.header("access-control-max-age", "86400");
});

// Preflight catch-all
app.options("/*", async (_req, reply) => {
  reply.code(204).send();
});

await app.register(gpuRoutes);
await app.register(providerRoutes);
await app.register(snapshotRoutes);
await app.register(async (a) => healthRoutes(a, { cronExpr: CRON_EXPR }));
await app.register(v1Routes);

// Serve built SPA in prod (run after `npm run build`).
const SPA_DIR = resolve(process.cwd(), "dist", "client");
if (existsSync(SPA_DIR)) {
  await app.register(fastifyStatic, { root: SPA_DIR, prefix: "/" });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith("/api/")) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    reply.type("text/html").sendFile("index.html");
  });
}

startPoller({ cronExpr: CRON_EXPR });

app.listen({ port: PORT, host: "0.0.0.0" }).then(() => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
