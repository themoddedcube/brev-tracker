// /v1/* — the public, stable, agent-friendly API surface.
//
// CORS is enabled globally in server/index.ts.
// All endpoints return JSON unless otherwise noted.
// No authentication.

import type { FastifyInstance } from "fastify";
import {
  listGpus,
  listConfigsForGpu,
  getGpuHistory,
  cheapestPerGpu,
  bestMatch,
  searchInstances,
  getMovers,
  listProviders,
  type HistoryRange,
} from "../aggregations.js";
import {
  db,
  getLatestSnapshot,
  getLastAttempt,
  snapshotCount,
  instanceCount,
  listProviderInfo,
} from "../db.js";
import { GPU_SLUGS } from "../scraper.js";
import { buildOpenApiSpec, buildLlmsTxt } from "../openapi.js";

// --- helpers --------------------------------------------------------------

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : undefined;
}

function int(v: unknown): number | undefined {
  const n = num(v);
  return n != null ? Math.trunc(n) : undefined;
}

function bool(v: unknown, dflt = false): boolean {
  if (v === undefined || v === null || v === "") return dflt;
  const s = String(v).toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

function windowToMs(s: string | undefined): number {
  switch ((s ?? "24h").toLowerCase()) {
    case "1h":  return 60 * 60 * 1000;
    case "24h": return 24 * 60 * 60 * 1000;
    case "7d":  return 7 * 24 * 60 * 60 * 1000;
    case "30d": return 30 * 24 * 60 * 60 * 1000;
    default:    return 24 * 60 * 60 * 1000;
  }
}

// 24h % change for one GPU based on its sparkline data
function computeChangePct24h(gpuName: string): number | null {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const rows = db
    .prepare(
      `SELECT s.fetched_at AS t,
              MIN(i.price_usd_per_hr / i.gpu_count) AS price
       FROM snapshots s
       JOIN instances i ON i.snapshot_id = s.id
       WHERE s.ok = 1 AND i.gpu_name = ? AND s.fetched_at >= ? AND i.is_available = 1
       GROUP BY s.id
       ORDER BY s.fetched_at ASC`,
    )
    .all(gpuName, cutoff) as { t: number; price: number }[];
  if (rows.length < 2) return null;
  const first = rows[0].price;
  const last = rows[rows.length - 1].price;
  if (first <= 0) return null;
  return ((last - first) / first) * 100;
}

// --- routes ---------------------------------------------------------------

export default async function v1Routes(app: FastifyInstance) {
  // ---- meta -----------------------------------------------------------

  app.get("/v1/openapi.json", async (req, reply) => {
    const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
    const host = req.headers.host;
    const base = `${proto}://${host}`;
    reply.header("content-type", "application/json");
    return buildOpenApiSpec(base);
  });

  app.get("/v1/llms.txt", async (req, reply) => {
    const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
    const host = req.headers.host;
    const base = `${proto}://${host}`;
    reply.header("content-type", "text/plain; charset=utf-8");
    return buildLlmsTxt(base);
  });

  app.get("/v1/health", async () => {
    const latest = getLatestSnapshot() ?? null;
    const lastAttempt = getLastAttempt() ?? null;
    return {
      ok: true,
      source: "getdeploying.com",
      tracked_gpu_skus: GPU_SLUGS.length,
      snapshot_count: snapshotCount(),
      instance_row_count: instanceCount(),
      last_poll_at: latest ? new Date(latest.fetched_at).toISOString() : null,
      last_poll_unix_ms: latest?.fetched_at ?? null,
      last_attempt_ok: lastAttempt?.ok === 1,
      last_attempt_error: lastAttempt?.error ?? null,
    };
  });

  // ---- gpus -----------------------------------------------------------

  app.get("/v1/gpus", async () => {
    const gpus = listGpus().map((g) => ({
      gpu_name: g.gpu_name,
      providers: g.providers,
      configs: g.configs,
      available: g.available,
      min_price_per_gpu: g.min_price,
      avg_price_per_gpu: g.avg_price,
      max_price_per_gpu: g.max_price,
      gpu_memory_gib_min: g.min_gpu_memory_gib,
      gpu_memory_gib_max: g.max_gpu_memory_gib,
      change_pct_24h: computeChangePct24h(g.gpu_name),
    }));
    return { gpus, count: gpus.length };
  });

  app.get<{ Params: { name: string } }>("/v1/gpus/:name", async (req) => {
    const name = decodeURIComponent(req.params.name);
    const configs = listConfigsForGpu(name);
    const cheapest = configs.find((c) => c.is_available === 1) ?? configs[0] ?? null;
    return {
      gpu_name: name,
      cheapest,
      configs_count: configs.length,
      configs,
    };
  });

  app.get<{ Params: { name: string }; Querystring: { range?: HistoryRange } }>(
    "/v1/gpus/:name/history",
    async (req) => {
      const name = decodeURIComponent(req.params.name);
      const range = (req.query.range as HistoryRange) ?? "7d";
      return { gpu_name: name, range, ...getGpuHistory(name, range) };
    },
  );

  app.get<{ Params: { name: string }; Querystring: { available_only?: string } }>(
    "/v1/gpus/:name/quote",
    async (req) => {
      const name = decodeURIComponent(req.params.name);
      const availableOnly = bool(req.query.available_only, true);
      let configs = listConfigsForGpu(name);
      if (availableOnly) configs = configs.filter((c) => c.is_available === 1);
      return {
        gpu_name: name,
        quoted_at: new Date().toISOString(),
        ranked: configs.map((c) => ({
          provider: c.provider,
          config_name: c.sub_location,
          gpu_count: c.gpu_count,
          gpu_memory_gib: c.gpu_memory_gib,
          vcpu: c.vcpu,
          memory_gib: c.memory_gib,
          price_per_gpu: c.price_per_gpu,
          price_total_per_hr: c.price_usd_per_hr,
          available: c.is_available === 1,
        })),
      };
    },
  );

  // ---- recommendation / agent endpoints --------------------------------

  app.get<{
    Querystring: {
      available_only?: string;
      min_vram?: string;
      max_price?: string;
      provider?: string;
      gpu_count?: string;
    };
  }>("/v1/cheapest", async (req) => {
    const rows = cheapestPerGpu({
      availableOnly: bool(req.query.available_only, true),
      minVramGib: num(req.query.min_vram),
      maxPricePerGpu: num(req.query.max_price),
      provider: req.query.provider || undefined,
      gpuCount: int(req.query.gpu_count),
    });
    return { count: rows.length, gpus: rows };
  });

  app.get<{
    Querystring: {
      gpu?: string;
      min_vram?: string;
      max_price?: string;
      provider?: string;
      min_gpu_count?: string;
      available_only?: string;
    };
  }>("/v1/best", async (req) => {
    const match = bestMatch({
      gpuName: req.query.gpu || undefined,
      minVramGib: num(req.query.min_vram),
      maxPricePerGpu: num(req.query.max_price),
      provider: req.query.provider || undefined,
      minGpuCount: int(req.query.min_gpu_count),
      availableOnly: bool(req.query.available_only, true),
    });
    return { match, matched_at: new Date().toISOString() };
  });

  app.get<{
    Querystring: {
      gpu?: string;
      min_vram?: string;
      max_price?: string;
      provider?: string;
      min_gpu_count?: string;
      max_gpu_count?: string;
      available_only?: string;
      limit?: string;
    };
  }>("/v1/search", async (req) => {
    const rows = searchInstances({
      gpuName: req.query.gpu || undefined,
      minVramGib: num(req.query.min_vram),
      maxPricePerGpu: num(req.query.max_price),
      provider: req.query.provider || undefined,
      minGpuCount: int(req.query.min_gpu_count),
      maxGpuCount: int(req.query.max_gpu_count),
      availableOnly: bool(req.query.available_only, true),
      limit: int(req.query.limit),
    });
    return { count: rows.length, results: rows };
  });

  app.get<{ Querystring: { window?: string; limit?: string } }>("/v1/movers", async (req) => {
    const ms = windowToMs(req.query.window);
    const limit = Math.min(100, Math.max(1, int(req.query.limit) ?? 20));
    const movers = getMovers(ms, limit);
    return { window: req.query.window ?? "24h", count: movers.length, movers };
  });

  // ---- providers ------------------------------------------------------

  app.get("/v1/providers", async () => {
    const summary = listProviders();
    const info = listProviderInfo();
    const infoMap = new Map(info.map((i) => [i.slug, i]));
    return {
      count: summary.length,
      providers: summary.map((p) => {
        const meta = infoMap.get(p.provider);
        return {
          slug: p.provider,
          label: meta?.label ?? p.provider,
          logo_url: meta?.logo_url ?? null,
          gpu_types: p.gpu_types,
          configs: p.configs,
          available: p.available,
          avg_price_per_gpu: p.avg_price_per_gpu,
          min_price_per_gpu: p.min_price_per_gpu,
        };
      }),
    };
  });
}
