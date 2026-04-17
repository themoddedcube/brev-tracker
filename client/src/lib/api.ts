async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

async function postJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { Accept: "application/json" } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(`${res.status}`), { body: json, status: res.status });
  return json as T;
}

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

export type HistoryRange = "24h" | "7d" | "30d" | "all";

export type HistoryResponse = {
  gpu_name: string;
  range: HistoryRange;
  t: number[]; // unix seconds
  series: { provider: string; prices: (number | null)[] }[];
};

export type CheapestPoint = { t: number; price: number; provider: string };
export type CheapestResponse = {
  gpu_name: string;
  range: HistoryRange;
  now: { price: number; provider: string; gpu_count: number; fetched_at: number } | null;
  points: CheapestPoint[];
};

export type ProviderSummary = {
  provider: string;
  gpu_types: number;
  configs: number;
  available: number;
  avg_price_per_gpu: number;
  min_price_per_gpu: number;
};

export type Health = {
  ok: boolean;
  source: string;
  tracked_skus: number;
  cron: string;
  snapshot_count: number;
  instance_row_count: number;
  latest_ok: { fetched_at: number; instance_count: number; duration_ms: number; ok: number; error: string | null } | null;
  last_attempt: { fetched_at: number; instance_count: number; duration_ms: number; ok: number; error: string | null } | null;
};

export const api = {
  gpus: () => getJSON<{ gpus: GpuSummary[] }>("/api/gpus"),
  gpu: (name: string) => getJSON<{ gpu_name: string; configs: GpuConfig[] }>(`/api/gpus/${encodeURIComponent(name)}`),
  history: (name: string, range: HistoryRange) =>
    getJSON<HistoryResponse>(`/api/gpus/${encodeURIComponent(name)}/history?range=${range}`),
  cheapest: (name: string, range: HistoryRange) =>
    getJSON<CheapestResponse>(`/api/gpus/${encodeURIComponent(name)}/cheapest?range=${range}`),
  sparkline: (name: string, points = 48) =>
    getJSON<{ gpu_name: string; points: { t: number; price: number }[] }>(
      `/api/gpus/${encodeURIComponent(name)}/sparkline?points=${points}`,
    ),
  providers: () => getJSON<{ providers: ProviderSummary[] }>("/api/providers"),
  providersLookup: () =>
    getJSON<{ providers: Record<string, { label: string; short_name: string | null; logo_url: string | null }> }>(
      "/api/providers/lookup",
    ),
  providersForGpu: (gpu: string) =>
    getJSON<{ gpu_name: string; providers: { provider: string; min_price_per_gpu: number; avg_price_per_gpu: number; configs: number }[] }>(
      `/api/providers/by-gpu?gpu=${encodeURIComponent(gpu)}`,
    ),
  health: () => getJSON<Health>("/api/health"),
  refresh: () => postJSON<{ triggered: boolean; result?: { ok: boolean; rows: number; durationMs: number; error?: string }; reason?: string }>("/api/refresh"),
};
