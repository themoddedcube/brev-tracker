import { db, getLatestSnapshot } from "./db.js";

export type GpuSummary = {
  gpu_name: string;
  providers: number;
  configs: number;
  available: number;
  min_price: number;
  avg_price: number;
  max_price: number;
  min_gpu_count: number;
  max_gpu_count: number;
  min_gpu_memory_gib: number;
  max_gpu_memory_gib: number;
};

export function listGpus(): GpuSummary[] {
  const latest = getLatestSnapshot();
  if (!latest) return [];
  return db
    .prepare(
      `SELECT gpu_name,
              COUNT(DISTINCT provider) AS providers,
              COUNT(*)                 AS configs,
              SUM(is_available)        AS available,
              MIN(price_usd_per_hr / gpu_count) AS min_price,
              AVG(price_usd_per_hr / gpu_count) AS avg_price,
              MAX(price_usd_per_hr / gpu_count) AS max_price,
              MIN(gpu_count)                    AS min_gpu_count,
              MAX(gpu_count)                    AS max_gpu_count,
              MIN(gpu_memory_gib)               AS min_gpu_memory_gib,
              MAX(gpu_memory_gib)               AS max_gpu_memory_gib
       FROM instances
       WHERE snapshot_id = ?
       GROUP BY gpu_name
       ORDER BY min_price ASC`,
    )
    .all(latest.id) as GpuSummary[];
}

export type GpuConfig = {
  type: string;
  provider: string;
  location: string;
  sub_location: string;
  gpu_count: number;
  gpu_memory_gib: number;
  vcpu: number;
  memory_gib: number;
  price_usd_per_hr: number;
  price_per_gpu: number;
  is_available: number;
};

export function listConfigsForGpu(gpuName: string): GpuConfig[] {
  const latest = getLatestSnapshot();
  if (!latest) return [];
  return db
    .prepare(
      `SELECT type, provider, location, sub_location, gpu_count, gpu_memory_gib,
              vcpu, memory_gib, price_usd_per_hr,
              (price_usd_per_hr / gpu_count) AS price_per_gpu,
              is_available
       FROM instances
       WHERE snapshot_id = ? AND gpu_name = ?
       ORDER BY price_per_gpu ASC`,
    )
    .all(latest.id, gpuName) as GpuConfig[];
}

export type HistoryRange = "24h" | "7d" | "30d" | "all";

function rangeToCutoff(range: HistoryRange): number {
  const now = Date.now();
  switch (range) {
    case "24h":
      return now - 24 * 60 * 60 * 1000;
    case "7d":
      return now - 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return now - 30 * 24 * 60 * 60 * 1000;
    case "all":
      return 0;
  }
}

export type HistoryResult = {
  t: number[]; // unix seconds (uPlot wants seconds)
  series: { provider: string; prices: (number | null)[] }[];
};

// Pivot rows into uPlot-friendly arrays. For each snapshot in range, we take
// the cheapest per-GPU price per provider for the given GPU.
export function getGpuHistory(gpuName: string, range: HistoryRange): HistoryResult {
  const cutoff = rangeToCutoff(range);
  const rows = db
    .prepare(
      `SELECT s.fetched_at AS t,
              i.provider   AS provider,
              MIN(i.price_usd_per_hr / i.gpu_count) AS price
       FROM snapshots s
       JOIN instances i ON i.snapshot_id = s.id
       WHERE s.ok = 1
         AND s.fetched_at >= ?
         AND i.gpu_name = ?
       GROUP BY s.id, i.provider
       ORDER BY s.fetched_at ASC`,
    )
    .all(cutoff, gpuName) as { t: number; provider: string; price: number }[];

  if (rows.length === 0) return { t: [], series: [] };

  const tSet = new Map<number, number>(); // ms → index
  const ts: number[] = [];
  const providers = new Set<string>();
  for (const r of rows) {
    if (!tSet.has(r.t)) {
      tSet.set(r.t, ts.length);
      ts.push(r.t);
    }
    providers.add(r.provider);
  }

  const providerList = [...providers].sort();
  const series = providerList.map((p) => ({
    provider: p,
    prices: new Array<number | null>(ts.length).fill(null),
  }));
  const idxByProvider = new Map(providerList.map((p, i) => [p, i]));
  for (const r of rows) {
    const ti = tSet.get(r.t)!;
    const si = idxByProvider.get(r.provider)!;
    series[si].prices[ti] = r.price;
  }

  // Downsample if very long
  let outT = ts;
  let outSeries = series;
  if (ts.length > 2000) {
    const stride = Math.ceil(ts.length / 2000);
    outT = [];
    outSeries = providerList.map((p) => ({ provider: p, prices: [] as (number | null)[] }));
    for (let i = 0; i < ts.length; i += stride) {
      outT.push(ts[i]);
      for (let s = 0; s < series.length; s++) outSeries[s].prices.push(series[s].prices[i]);
    }
  }

  // uPlot wants seconds, not ms.
  return { t: outT.map((ms) => Math.floor(ms / 1000)), series: outSeries };
}

export type ProviderSummary = {
  provider: string;
  gpu_types: number;
  configs: number;
  available: number;
  avg_price_per_gpu: number;
  min_price_per_gpu: number;
};

export function listProviders(): ProviderSummary[] {
  const latest = getLatestSnapshot();
  if (!latest) return [];
  return db
    .prepare(
      `SELECT provider,
              COUNT(DISTINCT gpu_name) AS gpu_types,
              COUNT(*) AS configs,
              SUM(is_available) AS available,
              AVG(price_usd_per_hr / gpu_count) AS avg_price_per_gpu,
              MIN(price_usd_per_hr / gpu_count) AS min_price_per_gpu
       FROM instances
       WHERE snapshot_id = ?
       GROUP BY provider
       ORDER BY provider ASC`,
    )
    .all(latest.id) as ProviderSummary[];
}

// Average price per provider for a given GPU (for the providers bar chart).
export type ProviderForGpu = {
  provider: string;
  min_price_per_gpu: number;
  avg_price_per_gpu: number;
  configs: number;
};

export function providersForGpu(gpuName: string): ProviderForGpu[] {
  const latest = getLatestSnapshot();
  if (!latest) return [];
  return db
    .prepare(
      `SELECT provider,
              MIN(price_usd_per_hr / gpu_count) AS min_price_per_gpu,
              AVG(price_usd_per_hr / gpu_count) AS avg_price_per_gpu,
              COUNT(*) AS configs
       FROM instances
       WHERE snapshot_id = ? AND gpu_name = ?
       GROUP BY provider
       ORDER BY min_price_per_gpu ASC`,
    )
    .all(latest.id, gpuName) as ProviderForGpu[];
}

// Sparkline data: most recent N points of the cheapest per-GPU price per snapshot.
export type SparkPoint = { t: number; price: number };

// One row per GPU showing the current cheapest available config.
// Used for /v1/cheapest and as the foundation for autonomous agent selection.
export type CheapestRow = {
  gpu_name: string;
  provider: string;
  type: string;
  config_name: string;
  gpu_count: number;
  gpu_memory_gib: number;
  vcpu: number;
  memory_gib: number;
  price_per_gpu: number;
  price_total_per_hr: number;
  is_available: number;
  region: string;
};

export function cheapestPerGpu(opts: {
  availableOnly?: boolean;
  minVramGib?: number;
  maxPricePerGpu?: number;
  provider?: string;
  gpuCount?: number;
} = {}): CheapestRow[] {
  const latest = getLatestSnapshot();
  if (!latest) return [];
  const where: string[] = ["snapshot_id = ?"];
  const params: any[] = [latest.id];
  if (opts.availableOnly) where.push("is_available = 1");
  if (opts.minVramGib != null) { where.push("gpu_memory_gib >= ?"); params.push(opts.minVramGib); }
  if (opts.maxPricePerGpu != null) { where.push("(price_usd_per_hr / gpu_count) <= ?"); params.push(opts.maxPricePerGpu); }
  if (opts.provider) { where.push("provider = ?"); params.push(opts.provider); }
  if (opts.gpuCount != null) { where.push("gpu_count = ?"); params.push(opts.gpuCount); }

  // For each gpu_name pick the row with the lowest price_per_gpu.
  return db
    .prepare(
      `WITH ranked AS (
         SELECT gpu_name, provider, type, sub_location AS config_name,
                gpu_count, gpu_memory_gib, vcpu, memory_gib,
                (price_usd_per_hr / gpu_count) AS price_per_gpu,
                price_usd_per_hr AS price_total_per_hr,
                is_available, location AS region,
                ROW_NUMBER() OVER (
                  PARTITION BY gpu_name
                  ORDER BY (price_usd_per_hr / gpu_count) ASC
                ) AS rn
         FROM instances
         WHERE ${where.join(" AND ")}
       )
       SELECT * FROM ranked WHERE rn = 1 ORDER BY price_per_gpu ASC`,
    )
    .all(...params) as CheapestRow[];
}

// Single best match across the entire catalog for given filters.
// This is the "auto-pick the cheapest GPU that meets my requirements" endpoint.
export function bestMatch(opts: {
  gpuName?: string;
  minVramGib?: number;
  maxPricePerGpu?: number;
  provider?: string;
  minGpuCount?: number;
  availableOnly?: boolean;
}): CheapestRow | null {
  const latest = getLatestSnapshot();
  if (!latest) return null;
  const where: string[] = ["snapshot_id = ?"];
  const params: any[] = [latest.id];
  if (opts.availableOnly !== false) where.push("is_available = 1");
  if (opts.gpuName) { where.push("gpu_name = ?"); params.push(opts.gpuName); }
  if (opts.minVramGib != null) { where.push("gpu_memory_gib >= ?"); params.push(opts.minVramGib); }
  if (opts.maxPricePerGpu != null) { where.push("(price_usd_per_hr / gpu_count) <= ?"); params.push(opts.maxPricePerGpu); }
  if (opts.provider) { where.push("provider = ?"); params.push(opts.provider); }
  if (opts.minGpuCount != null) { where.push("gpu_count >= ?"); params.push(opts.minGpuCount); }

  const r = db
    .prepare(
      `SELECT gpu_name, provider, type, sub_location AS config_name,
              gpu_count, gpu_memory_gib, vcpu, memory_gib,
              (price_usd_per_hr / gpu_count) AS price_per_gpu,
              price_usd_per_hr AS price_total_per_hr,
              is_available, location AS region
       FROM instances
       WHERE ${where.join(" AND ")}
       ORDER BY (price_usd_per_hr / gpu_count) ASC
       LIMIT 1`,
    )
    .get(...params) as CheapestRow | undefined;
  return r ?? null;
}

// Search / filter across the catalog. Like bestMatch but returns many.
export function searchInstances(opts: {
  gpuName?: string;
  minVramGib?: number;
  maxPricePerGpu?: number;
  provider?: string;
  minGpuCount?: number;
  maxGpuCount?: number;
  availableOnly?: boolean;
  limit?: number;
}): CheapestRow[] {
  const latest = getLatestSnapshot();
  if (!latest) return [];
  const where: string[] = ["snapshot_id = ?"];
  const params: any[] = [latest.id];
  if (opts.availableOnly !== false) where.push("is_available = 1");
  if (opts.gpuName) { where.push("gpu_name = ?"); params.push(opts.gpuName); }
  if (opts.minVramGib != null) { where.push("gpu_memory_gib >= ?"); params.push(opts.minVramGib); }
  if (opts.maxPricePerGpu != null) { where.push("(price_usd_per_hr / gpu_count) <= ?"); params.push(opts.maxPricePerGpu); }
  if (opts.provider) { where.push("provider = ?"); params.push(opts.provider); }
  if (opts.minGpuCount != null) { where.push("gpu_count >= ?"); params.push(opts.minGpuCount); }
  if (opts.maxGpuCount != null) { where.push("gpu_count <= ?"); params.push(opts.maxGpuCount); }
  const limit = Math.min(500, Math.max(1, opts.limit ?? 100));

  return db
    .prepare(
      `SELECT gpu_name, provider, type, sub_location AS config_name,
              gpu_count, gpu_memory_gib, vcpu, memory_gib,
              (price_usd_per_hr / gpu_count) AS price_per_gpu,
              price_usd_per_hr AS price_total_per_hr,
              is_available, location AS region
       FROM instances
       WHERE ${where.join(" AND ")}
       ORDER BY price_per_gpu ASC
       LIMIT ?`,
    )
    .all(...params, limit) as CheapestRow[];
}

// Biggest price movers in a window. Compare the most recent snapshot's
// cheapest price for each GPU against the cheapest at the start of window.
export type Mover = {
  gpu_name: string;
  price_now: number;
  price_then: number;
  delta: number;
  delta_pct: number;
  provider_now: string;
};

export function getMovers(windowMs: number, limit = 20): Mover[] {
  const latest = getLatestSnapshot();
  if (!latest) return [];
  const cutoff = Date.now() - windowMs;
  // For each GPU: cheapest price now (latest snapshot) and cheapest "then" (oldest snapshot >= cutoff)
  const rows = db
    .prepare(
      `WITH bounds AS (
         SELECT gpu_name,
                MIN(s.fetched_at) AS first_at,
                MAX(s.fetched_at) AS last_at
         FROM snapshots s
         JOIN instances i ON i.snapshot_id = s.id
         WHERE s.ok = 1 AND s.fetched_at >= ? AND i.is_available = 1
         GROUP BY i.gpu_name
       ),
       priced AS (
         SELECT i.gpu_name,
                s.fetched_at,
                MIN(i.price_usd_per_hr / i.gpu_count) AS price,
                (
                  SELECT i2.provider FROM instances i2
                  WHERE i2.snapshot_id = s.id AND i2.gpu_name = i.gpu_name AND i2.is_available = 1
                  ORDER BY (i2.price_usd_per_hr / i2.gpu_count) ASC LIMIT 1
                ) AS provider
         FROM snapshots s
         JOIN instances i ON i.snapshot_id = s.id
         WHERE s.ok = 1 AND i.is_available = 1
         GROUP BY i.gpu_name, s.fetched_at
       )
       SELECT b.gpu_name,
              p_now.price AS price_now,
              p_now.provider AS provider_now,
              p_then.price AS price_then
       FROM bounds b
       JOIN priced p_now  ON p_now.gpu_name  = b.gpu_name AND p_now.fetched_at  = b.last_at
       JOIN priced p_then ON p_then.gpu_name = b.gpu_name AND p_then.fetched_at = b.first_at
       WHERE p_then.price IS NOT NULL AND p_now.price IS NOT NULL`,
    )
    .all(cutoff) as { gpu_name: string; price_now: number; price_then: number; provider_now: string }[];

  const movers: Mover[] = rows
    .map((r) => ({
      gpu_name: r.gpu_name,
      price_now: r.price_now,
      price_then: r.price_then,
      delta: r.price_now - r.price_then,
      delta_pct: r.price_then > 0 ? ((r.price_now - r.price_then) / r.price_then) * 100 : 0,
      provider_now: r.provider_now,
    }))
    .filter((m) => m.delta !== 0)
    .sort((a, b) => Math.abs(b.delta_pct) - Math.abs(a.delta_pct))
    .slice(0, limit);

  return movers;
}

export function getGpuSparkline(gpuName: string, points = 48): SparkPoint[] {
  return db
    .prepare(
      `SELECT s.fetched_at AS t,
              MIN(i.price_usd_per_hr / i.gpu_count) AS price
       FROM snapshots s
       JOIN instances i ON i.snapshot_id = s.id
       WHERE s.ok = 1 AND i.gpu_name = ?
       GROUP BY s.id
       ORDER BY s.fetched_at DESC
       LIMIT ?`,
    )
    .all(gpuName, points)
    .reverse() as SparkPoint[];
}

// Time-series of the single cheapest price per snapshot — the "market price"
// for a GPU. Powers the Binance-style hero chart.
export type CheapestPoint = { t: number; price: number; provider: string };

export function getCheapestHistory(gpuName: string, range: HistoryRange): CheapestPoint[] {
  const cutoff = rangeToCutoff(range);
  // For each snapshot, pick the row with the cheapest price_per_gpu and report
  // both the price and which provider it belongs to.
  const rows = db
    .prepare(
      `WITH ranked AS (
         SELECT s.fetched_at AS t,
                i.provider,
                (i.price_usd_per_hr / i.gpu_count) AS price,
                ROW_NUMBER() OVER (
                  PARTITION BY s.id
                  ORDER BY (i.price_usd_per_hr / i.gpu_count) ASC
                ) AS rn
         FROM snapshots s
         JOIN instances i ON i.snapshot_id = s.id
         WHERE s.ok = 1
           AND s.fetched_at >= ?
           AND i.gpu_name = ?
           AND i.is_available = 1
       )
       SELECT t, provider, price FROM ranked WHERE rn = 1 ORDER BY t ASC`,
    )
    .all(cutoff, gpuName) as CheapestPoint[];
  return rows;
}

// Latest snapshot's cheapest price + provider — for the big number on the page.
export type CheapestNow = {
  price: number;
  provider: string;
  gpu_count: number;
  fetched_at: number;
} | null;

export function getCheapestNow(gpuName: string): CheapestNow {
  const r = db
    .prepare(
      `SELECT s.fetched_at AS fetched_at,
              i.provider AS provider,
              i.gpu_count AS gpu_count,
              (i.price_usd_per_hr / i.gpu_count) AS price
       FROM snapshots s
       JOIN instances i ON i.snapshot_id = s.id
       WHERE s.ok = 1 AND i.gpu_name = ? AND i.is_available = 1
       ORDER BY s.fetched_at DESC, price ASC
       LIMIT 1`,
    )
    .get(gpuName) as CheapestNow;
  return r ?? null;
}
