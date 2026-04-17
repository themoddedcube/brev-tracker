// Scrapes getdeploying.com for GPU pricing. Each GPU page embeds a
// <script id="gpu-model-data" type="application/json"> with an array of
// listings (one per provider × configuration × billing type).
//
// We fetch one page per GPU SKU we care about, parse the JSON, filter to
// ON_DEMAND, and normalize to our InstanceRow shape.

import type { InstanceRow } from "./types.js";
import { upsertProviders, type ProviderInfo } from "./db.js";

const BASE = "https://getdeploying.com";

// Datacenter / pro SKUs that overlap with what Brev's catalog covers.
// Add more slugs from https://getdeploying.com/gpus if you want consumer cards.
export const GPU_SLUGS: { slug: string; display: string }[] = [
  { slug: "nvidia-b200",          display: "B200" },
  { slug: "nvidia-h200",          display: "H200" },
  { slug: "nvidia-h100",          display: "H100" },
  { slug: "nvidia-a100",          display: "A100" },
  { slug: "nvidia-l40s",          display: "L40S" },
  { slug: "nvidia-l40",           display: "L40" },
  { slug: "nvidia-l4",            display: "L4" },
  { slug: "nvidia-rtx-pro-6000",  display: "RTX PRO 6000" },
  { slug: "nvidia-rtx-6000-ada",  display: "RTX 6000 Ada" },
  { slug: "nvidia-rtx-4000-ada",  display: "RTX 4000 Ada" },
  { slug: "nvidia-rtx-5090",      display: "RTX 5090" },
  { slug: "nvidia-a10",           display: "A10" },
  { slug: "nvidia-a10g",          display: "A10G" },
  { slug: "nvidia-a16",           display: "A16" },
  { slug: "nvidia-a40",           display: "A40" },
  { slug: "nvidia-a6000",         display: "A6000" },
  { slug: "nvidia-a5000",         display: "A5000" },
  { slug: "nvidia-a4000",         display: "A4000" },
  { slug: "nvidia-t4",            display: "T4" },
  { slug: "nvidia-v100",          display: "V100" },
  { slug: "nvidia-p4",            display: "P4" },
  { slug: "amd-mi300x",           display: "MI300X" },
];

type GdRecord = {
  id: number;
  name: string;
  gpu_count: number;
  billing_type: "ON_DEMAND" | "RESERVATION" | "SPOT" | "CUSTOM";
  availability: "AVAILABLE" | "UNAVAILABLE" | string;
  provider: { slug: string; name: string; short_name?: string; logo_url?: string };
  gpu: { short_name: string };
  data_vram?: string;       // total vram across the instance, in GB (string)
  data_cpus?: string | number;
  data_ram?: string | number; // GB string
  data_price?: string;      // total $/hr (string)
  data_price_per_gpu?: string;
};

const SCRIPT_RE =
  /<script id="gpu-model-data" type="application\/json">([\s\S]*?)<\/script>/;

async function fetchGpuPage(slug: string): Promise<GdRecord[]> {
  const url = `${BASE}/gpus/${slug}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; brev-tracker/0.1; +local) GPU pricing aggregator",
      Accept: "text/html",
      "Accept-Encoding": "gzip, deflate, br",
    },
  });
  if (!res.ok) throw new Error(`getdeploying ${slug}: HTTP ${res.status}`);
  const html = await res.text();
  const m = SCRIPT_RE.exec(html);
  if (!m) throw new Error(`getdeploying ${slug}: gpu-model-data script not found`);
  const data = JSON.parse(m[1]);
  if (!Array.isArray(data)) throw new Error(`getdeploying ${slug}: data is not an array`);
  return data as GdRecord[];
}

function num(x: string | number | undefined | null): number {
  if (x == null) return 0;
  const n = typeof x === "number" ? x : parseFloat(x);
  return Number.isFinite(n) ? n : 0;
}

function normalize(slug: string, displayName: string, rec: GdRecord): InstanceRow | null {
  if (rec.billing_type !== "ON_DEMAND") return null;
  const total = num(rec.data_price);
  if (total <= 0) return null;
  const gpuCount = rec.gpu_count || 1;
  const totalVramGiB = num(rec.data_vram); // in GB on the source — treat as GiB-equivalent for display
  const perGpuVram = gpuCount > 0 ? totalVramGiB / gpuCount : totalVramGiB;
  return {
    // type uses the listing id to guarantee uniqueness inside a snapshot.
    type: `${rec.provider.slug}#${rec.id}`,
    provider: rec.provider.slug || "unknown",
    location: "", // not provided by getdeploying
    sub_location: rec.name || "", // human-readable config (e.g. "1x H100 80GB SXM")
    gpu_name: displayName,
    gpu_count: gpuCount,
    gpu_memory_gib: perGpuVram,
    vcpu: Math.round(num(rec.data_cpus)),
    memory_gib: num(rec.data_ram),
    price_usd_per_hr: total,
    is_available: rec.availability === "AVAILABLE" ? 1 : 0,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type ScrapeResult = {
  rows: InstanceRow[];
  perGpu: { slug: string; display: string; ok: boolean; count: number; error?: string }[];
};

export async function scrapeAll(): Promise<ScrapeResult> {
  const rows: InstanceRow[] = [];
  const perGpu: ScrapeResult["perGpu"] = [];
  const providerMap = new Map<string, ProviderInfo>();

  for (const { slug, display } of GPU_SLUGS) {
    try {
      const records = await fetchGpuPage(slug);
      // Capture provider metadata as we go
      for (const rec of records) {
        const p = rec.provider;
        if (!p?.slug) continue;
        if (!providerMap.has(p.slug)) {
          providerMap.set(p.slug, {
            slug: p.slug,
            label: p.name || p.slug,
            short_name: p.short_name ?? null,
            logo_url: p.logo_url ?? null,
          });
        } else if (p.logo_url) {
          // Keep the row with a logo URL if we previously had none
          const existing = providerMap.get(p.slug)!;
          if (!existing.logo_url) existing.logo_url = p.logo_url;
        }
      }
      const normalized = records
        .map((r) => normalize(slug, display, r))
        .filter((r): r is InstanceRow => r !== null);
      rows.push(...normalized);
      perGpu.push({ slug, display, ok: true, count: normalized.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      perGpu.push({ slug, display, ok: false, count: 0, error: msg });
      console.warn(`[scraper] ${slug} failed: ${msg}`);
    }
    // Be polite — small delay between requests
    await sleep(350);
  }

  if (providerMap.size > 0) upsertProviders([...providerMap.values()]);
  return { rows, perGpu };
}
