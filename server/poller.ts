import cron, { type ScheduledTask } from "node-cron";
import { scrapeAll } from "./scraper.js";
import { recordSnapshot, getLatestSnapshot } from "./db.js";

const ONE_HOUR_MS = 60 * 60 * 1000;
const REFRESH_THROTTLE_MS = 60 * 1000;

let lastTriggerAt = 0;
let inFlight: Promise<PollResult> | null = null;
let scheduled: ScheduledTask | null = null;

export type PollResult = {
  ok: boolean;
  rows: number;
  durationMs: number;
  error?: string;
  perGpu?: { slug: string; display: string; ok: boolean; count: number; error?: string }[];
};

export async function runPollOnce(): Promise<PollResult> {
  if (inFlight) return inFlight;
  const started = Date.now();
  inFlight = (async () => {
    try {
      const { rows, perGpu } = await scrapeAll();
      const durationMs = Date.now() - started;
      recordSnapshot({ fetchedAt: started, durationMs, ok: true, rows });
      const failedSkus = perGpu.filter((p) => !p.ok).length;
      console.log(
        `[poller] OK · ${rows.length} rows · ${perGpu.length - failedSkus}/${perGpu.length} SKUs · ${durationMs}ms`,
      );
      return { ok: true, rows: rows.length, durationMs, perGpu };
    } catch (err) {
      const durationMs = Date.now() - started;
      const msg = err instanceof Error ? err.message : String(err);
      recordSnapshot({ fetchedAt: started, durationMs, ok: false, error: msg, rows: [] });
      console.error(`[poller] FAIL · ${msg} · ${durationMs}ms`);
      return { ok: false, rows: 0, durationMs, error: msg };
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export async function triggerManualRefresh(): Promise<
  { triggered: true; result: PollResult } | { triggered: false; reason: string; nextAllowedAt: number }
> {
  const now = Date.now();
  const last = getLatestSnapshot();
  if (last && now - last.fetched_at < REFRESH_THROTTLE_MS) {
    return {
      triggered: false,
      reason: `Last successful refresh ${Math.round((now - last.fetched_at) / 1000)}s ago. Please wait.`,
      nextAllowedAt: last.fetched_at + REFRESH_THROTTLE_MS,
    };
  }
  if (now - lastTriggerAt < REFRESH_THROTTLE_MS) {
    return {
      triggered: false,
      reason: `Refresh already triggered ${Math.round((now - lastTriggerAt) / 1000)}s ago.`,
      nextAllowedAt: lastTriggerAt + REFRESH_THROTTLE_MS,
    };
  }
  lastTriggerAt = now;
  const result = await runPollOnce();
  return { triggered: true, result };
}

export function startPoller(opts: { cronExpr: string }): void {
  if (scheduled) scheduled.stop();

  const last = getLatestSnapshot();
  const stale = !last || Date.now() - last.fetched_at > ONE_HOUR_MS;
  if (stale) {
    console.log("[poller] no recent snapshot — running initial scrape");
    void runPollOnce();
  } else {
    console.log(
      `[poller] last snapshot ${Math.round((Date.now() - last.fetched_at) / 60000)}min ago — skipping initial scrape`,
    );
  }

  if (!cron.validate(opts.cronExpr)) {
    console.warn(`[poller] invalid cron "${opts.cronExpr}", falling back to */30 * * * *`);
    opts.cronExpr = "*/30 * * * *";
  }
  scheduled = cron.schedule(opts.cronExpr, () => {
    void runPollOnce();
  });
  console.log(`[poller] scheduled with "${opts.cronExpr}"`);
}
