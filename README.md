# Brev Price Index

The authoritative live price index for every GPU in the [Brev](https://brev.nvidia.com) catalog. A continuously-polling integration that tracks per-provider, per-region GPU pricing across every cloud Brev runs on, persists snapshots to SQLite, and renders fast time-series charts with [uPlot](https://leeoniya.github.io/uPlot/). Styled per `DESIGN.md`.

Pricing is sourced from the public [getdeploying.com](https://getdeploying.com) catalog (no auth required), which mirrors the same providers Brev aggregates — Lambda, RunPod, Crusoe, Shadeform, Nebius, AWS, GCP, and more.

## Setup

```bash
npm install
cp .env.example .env   # optional — defaults work
```

No tokens. No accounts.

## Run

```bash
npm run dev
```

- Frontend dev server: http://localhost:5173
- Backend (API + poller): http://localhost:3001

The poller runs once at startup (if the latest snapshot is >1h old or the DB is empty), then on the cron schedule (default every 30 min). Each snapshot fetches ~22 GPU pages from getdeploying.com in series with a small politeness delay (~10–15s total).

## Build & serve as one

```bash
npm run build
npm start
```

Then open http://localhost:3001.

## Verify

- `GET /api/health` — poller status, source, DB row counts.
- Click "Refresh now" on the Settings page to force a snapshot (60s throttle).
- Sparklines need ≥2 snapshots; wait through one poll cycle (or hit refresh again after the throttle).

## What's tracked

On-demand listings only (reservations and spot are excluded so the chart is apples-to-apples). The tracked GPU SKUs are listed in `server/scraper.ts` → `GPU_SLUGS`. Add or remove slugs there to adjust coverage; valid slugs are anything from `https://getdeploying.com/gpus/...`.

## Deploy to Railway

This repo ships a `Dockerfile` and `railway.json`. Railway is the right host for this app because it supports a long-running Node process and a persistent disk for SQLite.

1. **Push to GitHub.**
   ```bash
   git init && git add . && git commit -m "initial"
   gh repo create brev-tracker --public --source=. --push
   ```
   (or just push to a repo you already have).

2. **Create a Railway project.**
   - Go to <https://railway.app/new> → "Deploy from GitHub repo" → pick `brev-tracker`.
   - Railway detects `railway.json`, uses the `Dockerfile`, builds, and runs.

3. **Attach a volume so the SQLite history persists across deploys.**
   - In the service: **Settings → Volumes → New Volume**.
   - Mount path: `/app/data` (matches the `VOLUME` directive in the Dockerfile).
   - Size: 1 GiB is plenty — the DB grows ~30 KB per snapshot.

4. **(Optional) tweak env vars.**
   - `POLL_CRON` — defaults to `*/2 * * * *`. Use `*/5 * * * *` if you want lighter scraping.
   - `PORT` — Railway sets this automatically. Don't override.

5. **Generate a public domain** under **Settings → Networking → Generate Domain**. The `/api/health` endpoint Railway uses for healthchecks is already wired in `railway.json`.

That's it — the poller starts on boot, snapshots accumulate in the volume, and the SPA is served from the same Node process.

### Local Docker test

```bash
docker build -t brev-tracker .
docker run --rm -p 3001:3001 -v brev_data:/app/data brev-tracker
# → http://localhost:3001
```
