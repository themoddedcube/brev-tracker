// One-shot Wayback Machine backfill.
//
// For each tracked GPU SKU we ask Wayback's CDX API for every archived
// capture of its getdeploying page, fetch each capture's raw HTML, parse the
// embedded `gpu-model-data` JSON the same way the live scraper does, and
// insert each capture as a historical snapshot row in our DB — using the
// archive's actual capture timestamp (so the chart's x-axis is real).
//
// Run with `npm run backfill`.

import { GPU_SLUGS } from "./scraper.js";
import { db, recordSnapshot, upsertProviders, type ProviderInfo } from "./db.js";
import type { InstanceRow } from "./types.js";

const providerMap = new Map<string, ProviderInfo>();

const CDX = "https://web.archive.org/cdx/search/cdx";
const WAYBACK = "https://web.archive.org/web";

type Capture = { timestampMs: number; ts14: string; digest: string };

const SCRIPT_RE =
  /<script id="gpu-model-data" type="application\/json">([\s\S]*?)<\/script>/;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function ts14ToMs(ts: string): number {
  // YYYYMMDDhhmmss → ms
  const y = +ts.slice(0, 4);
  const mo = +ts.slice(4, 6) - 1;
  const d = +ts.slice(6, 8);
  const h = +ts.slice(8, 10);
  const mi = +ts.slice(10, 12);
  const s = +ts.slice(12, 14);
  return Date.UTC(y, mo, d, h, mi, s);
}

async function listCaptures(slug: string): Promise<Capture[]> {
  const url = `${CDX}?url=getdeploying.com/gpus/${slug}&output=json&filter=statuscode:200&fl=timestamp,digest`;
  const res = await fetch(url, {
    headers: { "User-Agent": "brev-tracker/0.1 backfill (+local)" },
  });
  if (!res.ok) throw new Error(`CDX ${slug}: HTTP ${res.status}`);
  const arr = (await res.json()) as string[][];
  if (!Array.isArray(arr) || arr.length < 2) return [];
  // First row is headers
  const seen = new Set<string>();
  const out: Capture[] = [];
  for (let i = 1; i < arr.length; i++) {
    const [ts14, digest] = arr[i];
    if (!ts14 || !digest) continue;
    if (seen.has(digest)) continue; // skip dupes (Wayback collapses identical content)
    seen.add(digest);
    out.push({ timestampMs: ts14ToMs(ts14), ts14, digest });
  }
  return out;
}

async function fetchCapture(slug: string, ts14: string): Promise<string> {
  // The `id_` modifier returns the ORIGINAL response without Wayback's frame
  // injection — critical, otherwise the script tag gets rewritten.
  const url = `${WAYBACK}/${ts14}id_/https://getdeploying.com/gpus/${slug}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "brev-tracker/0.1 backfill (+local)" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`capture ${ts14}: HTTP ${res.status}`);
  return res.text();
}

function parseHtmlToRows(html: string, slug: string, display: string): InstanceRow[] {
  const m = SCRIPT_RE.exec(html);
  if (!m) return [];
  let data: any[];
  try {
    data = JSON.parse(m[1]);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: InstanceRow[] = [];
  for (const rec of data) {
    // Capture provider metadata even from records we skip (e.g. reservations)
    const p = rec?.provider;
    if (p?.slug) {
      const cur = providerMap.get(p.slug);
      if (!cur) {
        providerMap.set(p.slug, {
          slug: p.slug,
          label: p.name || p.slug,
          short_name: p.short_name ?? null,
          logo_url: p.logo_url ?? null,
        });
      } else if (!cur.logo_url && p.logo_url) {
        cur.logo_url = p.logo_url;
      }
    }
    if (rec?.billing_type !== "ON_DEMAND") continue;
    const total = parseFloat(rec.data_price ?? "");
    if (!Number.isFinite(total) || total <= 0) continue;
    const gpuCount = rec.gpu_count || 1;
    const totalVram = parseFloat(rec.data_vram ?? "0") || 0;
    out.push({
      type: `${rec.provider?.slug ?? "unknown"}#${rec.id}`,
      provider: rec.provider?.slug ?? "unknown",
      location: "",
      sub_location: rec.name ?? "",
      gpu_name: display,
      gpu_count: gpuCount,
      gpu_memory_gib: gpuCount > 0 ? totalVram / gpuCount : totalVram,
      vcpu: Math.round(parseFloat(String(rec.data_cpus ?? 0)) || 0),
      memory_gib: parseFloat(String(rec.data_ram ?? 0)) || 0,
      price_usd_per_hr: total,
      is_available: rec.availability === "AVAILABLE" ? 1 : 0,
    });
  }
  return out;
}

// Group all captures (across all GPUs) into "snapshot buckets" by capture day.
// One bucket = one snapshot row in our DB; rows from every GPU page captured
// in that bucket get attached to it. This mirrors how a live snapshot looks.
function bucketKey(ms: number): string {
  // 6-hour buckets give us enough resolution for a 30d chart without
  // creating a separate snapshot for every single Wayback hit.
  const d = new Date(ms);
  const sixH = Math.floor(d.getUTCHours() / 6) * 6;
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${sixH}`;
}

function bucketCenter(ms: number): number {
  const d = new Date(ms);
  const sixH = Math.floor(d.getUTCHours() / 6) * 6;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), sixH + 3, 0, 0);
}

type Bucket = {
  ts: number; // representative timestamp for the snapshot
  rows: InstanceRow[];
};

function isAlreadyImported(ts: number): boolean {
  // Avoid creating duplicates if the script is re-run.
  const r = db
    .prepare(
      `SELECT id FROM snapshots WHERE ok = 1 AND ABS(fetched_at - ?) < 60000 LIMIT 1`,
    )
    .get(ts);
  return !!r;
}

export async function runBackfill(): Promise<{
  buckets: number;
  rows: number;
  perGpu: { slug: string; display: string; captures: number; rows: number; error?: string }[];
}> {
  const buckets = new Map<string, Bucket>();
  const perGpu: { slug: string; display: string; captures: number; rows: number; error?: string }[] = [];

  for (const { slug, display } of GPU_SLUGS) {
    let captures: Capture[];
    try {
      captures = await listCaptures(slug);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[backfill] CDX ${slug}: ${msg}`);
      perGpu.push({ slug, display, captures: 0, rows: 0, error: msg });
      continue;
    }
    let rowCount = 0;
    for (const cap of captures) {
      try {
        const html = await fetchCapture(slug, cap.ts14);
        const rows = parseHtmlToRows(html, slug, display);
        if (rows.length === 0) continue;
        const key = bucketKey(cap.timestampMs);
        const center = bucketCenter(cap.timestampMs);
        const existing = buckets.get(key);
        if (existing) existing.rows.push(...rows);
        else buckets.set(key, { ts: center, rows: [...rows] });
        rowCount += rows.length;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[backfill] ${slug}@${cap.ts14}: ${msg}`);
      }
      // Wayback rate-limits aggressively. Be very polite.
      await sleep(800);
    }
    perGpu.push({ slug, display, captures: captures.length, rows: rowCount });
    console.log(
      `[backfill] ${display.padEnd(14)} · ${captures.length} captures · ${rowCount} rows`,
    );
  }

  // Insert each bucket as a historical snapshot, skipping any we already have.
  let inserted = 0;
  let totalRows = 0;
  for (const b of [...buckets.values()].sort((a, b) => a.ts - b.ts)) {
    if (isAlreadyImported(b.ts)) {
      console.log(`[backfill] skip bucket ${new Date(b.ts).toISOString()} (already imported)`);
      continue;
    }
    // Dedupe rows by their primary key inside this bucket
    const seen = new Set<string>();
    const dedup: InstanceRow[] = [];
    for (const r of b.rows) {
      const k = `${r.type}::${r.provider}::${r.location}::${r.sub_location}`;
      if (seen.has(k)) continue;
      seen.add(k);
      dedup.push(r);
    }
    recordSnapshot({ fetchedAt: b.ts, durationMs: 0, ok: true, rows: dedup });
    inserted++;
    totalRows += dedup.length;
  }

  if (providerMap.size > 0) {
    upsertProviders([...providerMap.values()]);
    console.log(`[backfill] upserted ${providerMap.size} providers (with logos where available)`);
  }
  return { buckets: inserted, rows: totalRows, perGpu };
}

// CLI entrypoint — pathToFileURL handles Windows + Unix consistently.
import { pathToFileURL } from "node:url";
const invokedAsScript =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedAsScript) {
  console.log(`[backfill] starting · ${GPU_SLUGS.length} GPU SKUs · this will take a few minutes`);
  runBackfill()
    .then((r) => {
      console.log(
        `[backfill] DONE · ${r.buckets} new historical snapshots · ${r.rows} rows`,
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error("[backfill] FAILED:", err);
      process.exit(1);
    });
}
