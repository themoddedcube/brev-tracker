import type { FastifyInstance } from "fastify";
import {
  listGpus,
  listConfigsForGpu,
  getGpuHistory,
  getGpuSparkline,
  getCheapestHistory,
  getCheapestNow,
  type HistoryRange,
} from "../aggregations.js";

export default async function gpuRoutes(app: FastifyInstance) {
  app.get("/api/gpus", async () => {
    return { gpus: listGpus() };
  });

  app.get<{ Params: { name: string } }>("/api/gpus/:name", async (req) => {
    const name = decodeURIComponent(req.params.name);
    return { gpu_name: name, configs: listConfigsForGpu(name) };
  });

  app.get<{ Params: { name: string }; Querystring: { range?: HistoryRange } }>(
    "/api/gpus/:name/history",
    async (req) => {
      const name = decodeURIComponent(req.params.name);
      const range: HistoryRange = (req.query.range as HistoryRange) ?? "7d";
      return { gpu_name: name, range, ...getGpuHistory(name, range) };
    },
  );

  app.get<{ Params: { name: string }; Querystring: { points?: string } }>(
    "/api/gpus/:name/sparkline",
    async (req) => {
      const name = decodeURIComponent(req.params.name);
      const points = Math.min(200, Math.max(2, parseInt(req.query.points ?? "48", 10) || 48));
      return { gpu_name: name, points: getGpuSparkline(name, points) };
    },
  );

  // Binance-style hero chart: just the cheapest price over time.
  app.get<{ Params: { name: string }; Querystring: { range?: HistoryRange } }>(
    "/api/gpus/:name/cheapest",
    async (req) => {
      const name = decodeURIComponent(req.params.name);
      const range: HistoryRange = (req.query.range as HistoryRange) ?? "7d";
      const points = getCheapestHistory(name, range);
      const now = getCheapestNow(name);
      return { gpu_name: name, range, now, points };
    },
  );
}
