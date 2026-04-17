import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { InstanceRow } from "./types.js";

// In production (Docker / Railway) we point at /app/data so a mounted volume
// catches it. Locally we keep it next to the project.
const DB_PATH =
  process.env.DB_PATH ??
  (process.env.NODE_ENV === "production"
    ? "/app/data/brev.sqlite"
    : resolve(process.cwd(), "data", "brev.sqlite"));
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS snapshots (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    fetched_at     INTEGER NOT NULL,
    instance_count INTEGER NOT NULL,
    duration_ms    INTEGER NOT NULL,
    ok             INTEGER NOT NULL,
    error          TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_snapshots_fetched_at ON snapshots(fetched_at);

  CREATE TABLE IF NOT EXISTS instances (
    snapshot_id      INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
    type             TEXT NOT NULL,
    provider         TEXT NOT NULL,
    location         TEXT NOT NULL,
    sub_location     TEXT NOT NULL,
    gpu_name         TEXT NOT NULL,
    gpu_count        INTEGER NOT NULL,
    gpu_memory_gib   REAL NOT NULL,
    vcpu             INTEGER NOT NULL,
    memory_gib       REAL NOT NULL,
    price_usd_per_hr REAL NOT NULL,
    is_available     INTEGER NOT NULL,
    PRIMARY KEY (snapshot_id, type, provider, location, sub_location)
  );
  CREATE INDEX IF NOT EXISTS idx_instances_gpu_time ON instances(gpu_name, snapshot_id);
  CREATE INDEX IF NOT EXISTS idx_instances_provider ON instances(provider, gpu_name);

  CREATE TABLE IF NOT EXISTS providers (
    slug        TEXT PRIMARY KEY,
    label       TEXT NOT NULL,
    short_name  TEXT,
    logo_url    TEXT,
    updated_at  INTEGER NOT NULL
  );
`);

const insertSnapshotStmt = db.prepare(
  `INSERT INTO snapshots (fetched_at, instance_count, duration_ms, ok, error)
   VALUES (?, ?, ?, ?, ?)`,
);

const insertInstanceStmt = db.prepare(
  `INSERT OR REPLACE INTO instances
   (snapshot_id, type, provider, location, sub_location, gpu_name, gpu_count,
    gpu_memory_gib, vcpu, memory_gib, price_usd_per_hr, is_available)
   VALUES (@snapshot_id, @type, @provider, @location, @sub_location, @gpu_name, @gpu_count,
           @gpu_memory_gib, @vcpu, @memory_gib, @price_usd_per_hr, @is_available)`,
);

export function recordSnapshot(args: {
  fetchedAt: number;
  durationMs: number;
  ok: boolean;
  error?: string;
  rows: InstanceRow[];
}): number {
  const result = insertSnapshotStmt.run(
    args.fetchedAt,
    args.rows.length,
    args.durationMs,
    args.ok ? 1 : 0,
    args.error ?? null,
  );
  const snapshotId = Number(result.lastInsertRowid);

  if (args.rows.length > 0) {
    const insertMany = db.transaction((rows: InstanceRow[]) => {
      for (const row of rows) {
        insertInstanceStmt.run({ snapshot_id: snapshotId, ...row });
      }
    });
    insertMany(args.rows);
  }
  return snapshotId;
}

export function getLatestSnapshot(): {
  id: number;
  fetched_at: number;
  instance_count: number;
  duration_ms: number;
  ok: number;
  error: string | null;
} | undefined {
  return db
    .prepare(`SELECT * FROM snapshots WHERE ok = 1 ORDER BY fetched_at DESC LIMIT 1`)
    .get() as any;
}

export function getLastAttempt(): {
  id: number;
  fetched_at: number;
  instance_count: number;
  duration_ms: number;
  ok: number;
  error: string | null;
} | undefined {
  return db
    .prepare(`SELECT * FROM snapshots ORDER BY fetched_at DESC LIMIT 1`)
    .get() as any;
}

export function snapshotCount(): number {
  return (db.prepare(`SELECT COUNT(*) as c FROM snapshots WHERE ok = 1`).get() as { c: number }).c;
}

export function instanceCount(): number {
  return (db.prepare(`SELECT COUNT(*) as c FROM instances`).get() as { c: number }).c;
}

const upsertProviderStmt = db.prepare(
  `INSERT INTO providers (slug, label, short_name, logo_url, updated_at)
   VALUES (@slug, @label, @short_name, @logo_url, @updated_at)
   ON CONFLICT(slug) DO UPDATE SET
     label      = excluded.label,
     short_name = excluded.short_name,
     logo_url   = COALESCE(excluded.logo_url, providers.logo_url),
     updated_at = excluded.updated_at`,
);

export type ProviderInfo = {
  slug: string;
  label: string;
  short_name: string | null;
  logo_url: string | null;
};

export function upsertProviders(items: ProviderInfo[]): void {
  if (items.length === 0) return;
  const now = Date.now();
  const tx = db.transaction((rows: ProviderInfo[]) => {
    for (const r of rows) {
      upsertProviderStmt.run({
        slug: r.slug,
        label: r.label,
        short_name: r.short_name,
        logo_url: r.logo_url,
        updated_at: now,
      });
    }
  });
  tx(items);
}

export function listProviderInfo(): ProviderInfo[] {
  return db
    .prepare(`SELECT slug, label, short_name, logo_url FROM providers ORDER BY slug`)
    .all() as ProviderInfo[];
}
