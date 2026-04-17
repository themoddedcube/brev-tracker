import type { FastifyInstance } from "fastify";
import { getLatestSnapshot, getLastAttempt } from "../db.js";
import { triggerManualRefresh } from "../poller.js";

export default async function snapshotRoutes(app: FastifyInstance) {
  app.get("/api/snapshot/latest", async () => {
    return { latest: getLatestSnapshot() ?? null, last_attempt: getLastAttempt() ?? null };
  });

  app.post("/api/refresh", async (_req, reply) => {
    const result = await triggerManualRefresh();
    if (!result.triggered) {
      reply.code(429);
      return result;
    }
    return result;
  });
}
