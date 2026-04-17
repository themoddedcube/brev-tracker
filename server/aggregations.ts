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
