import type { FastifyInstance } from "fastify";
import { getLatestSnapshot, getLastAttempt, snapshotCount, instanceCount } from "../db.js";
import { GPU_SLUGS } from "../scraper.js";

export default async function healthRoutes(app: FastifyInstance, opts: { cronExpr: string }) {
  app.get("/api/health", async () => {
    const latest = getLatestSnapshot() ?? null;
    const lastAttempt = getLastAttempt() ?? null;
    return {
      ok: true,
      source: "getdeploying.com",
      tracked_skus: GPU_SLUGS.length,
      cron: opts.cronExpr,
      snapshot_count: snapshotCount(),
      instance_row_count: instanceCount(),
      latest_ok: latest,
      last_attempt: lastAttempt,
    };
  });
}
