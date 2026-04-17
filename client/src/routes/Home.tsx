import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { GpuRow } from "../components/GpuRow";
import { Marquee } from "../components/Marquee";
import { ProviderLogo } from "../components/ProviderLogo";
import { HeroLiveGrid } from "../components/HeroLiveGrid";
import { CountUp } from "../components/CountUp";

type SortKey = "name" | "min" | "avg" | "max" | "providers" | "available";
type SortDir = "asc" | "desc";

// Default direction for each column — what feels natural on first click.
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  name: "asc",
  min: "asc",       // cheapest first
  avg: "asc",
  max: "desc",      // most expensive first
  providers: "desc",// most providers first
  available: "desc",// most live first
};

export default function Home() {
  const gpusQ = useQuery({ queryKey: ["gpus"], queryFn: api.gpus });
  const providersQ = useQuery({ queryKey: ["providers"], queryFn: api.providers });
  const healthQ = useQuery({ queryKey: ["health"], queryFn: api.health, refetchInterval: 30_000 });

  const [search, setSearch] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("min");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Click handler: same column → toggle dir; new column → set its default dir.
  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_DIR[key]);
    }
  }

  const gpus = useMemo(() => {
    let g = gpusQ.data?.gpus ?? [];
    if (search) {
      const q = search.toLowerCase();
      g = g.filter((x) => x.gpu_name.toLowerCase().includes(q));
    }
    if (availableOnly) g = g.filter((x) => x.available > 0);
    const mul = sortDir === "asc" ? 1 : -1;
    g = [...g].sort((a, b) => {
      switch (sortKey) {
        case "name":      return a.gpu_name.localeCompare(b.gpu_name) * mul;
        case "min":       return (a.min_price - b.min_price) * mul;
        case "avg":       return (a.avg_price - b.avg_price) * mul;
        case "max":       return (a.max_price - b.max_price) * mul;
        case "providers": return (a.providers - b.providers) * mul;
        case "available": return (a.available - b.available) * mul;
      }
    });
    return g;
  }, [gpusQ.data, search, availableOnly, sortKey, sortDir]);

  const totals = useMemo(() => {
    const all = gpusQ.data?.gpus ?? [];
    let configs = 0;
    for (const g of all) configs += g.configs;
    return {
      gpu_types: all.length,
      configs,
      providers: all.reduce((max, g) => Math.max(max, g.providers), 0),
    };
  }, [gpusQ.data]);

  // Touch healthQ so it remains warmed for the LIVE indicator + Settings page.
  void healthQ;

  const providerSlugs = useMemo(() => {
    const list = providersQ.data?.providers ?? [];
    return list
      .filter((p) => p.configs > 0)
      .sort((a, b) => b.configs - a.configs)
      .map((p) => p.provider);
  }, [providersQ.data]);

  return (
    <>
      {/* HERO */}
      <section className="bg-parchment border-b border-bordercream relative overflow-hidden">
        {/* Slow-drifting warm radial glow — Chainlink-style atmospheric backdrop */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none animate-glow-drift"
          style={{
            background:
              "radial-gradient(circle at 20% 30%, rgba(201,100,66,0.08) 0%, transparent 45%), radial-gradient(circle at 75% 70%, rgba(217,119,87,0.06) 0%, transparent 50%)",
          }}
        />
        <div className="relative max-w-container mx-auto px-6 pt-16 pb-10 md:pt-24 md:pb-14 grid md:grid-cols-[1fr_auto] gap-10 items-end">
          <div className="animate-fade-up">
            <div className="text-overline uppercase tracking-widest text-terracotta mb-3">
              Live GPU pricing on brev.nvidia.com
            </div>
            <h1 className="font-serif text-display text-nearblack">
              Track every GPU,<br />every provider, every hour.
            </h1>
            <p className="text-bodylarge text-olive mt-6 max-w-2xl">
              A small local dashboard that polls the Brev catalog, persists snapshots, and draws fast time-series charts. No mock data. No dashboards-as-a-service.
            </p>
          </div>
          <div className="animate-fade-up" style={{ animationDelay: "150ms" }}>
            <HeroLiveGrid />
          </div>
        </div>
      </section>

      {/* INLINE STATS — clean, monospace, restrained */}
      <section className="bg-parchment border-b border-bordercream">
        <div className="max-w-container mx-auto px-6 py-5 flex flex-wrap items-center gap-x-8 gap-y-3 text-bodysm">
          <Stat label="GPU types" value={totals.gpu_types} />
          <Divider />
          <Stat label="Configurations" value={totals.configs.toLocaleString()} />
          <Divider />
          <Stat label="Providers" value={totals.providers} />
          <div className="ml-auto flex items-center gap-2 text-overline uppercase tracking-widest text-stone">
            <span className="relative inline-flex w-2 h-2">
              <span className="absolute inline-flex w-full h-full rounded-full bg-terracotta opacity-50 animate-ping" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-terracotta" />
            </span>
            Live
          </div>
        </div>
      </section>

      {/* PROVIDER MARQUEE */}
      <section className="bg-ivory border-b border-bordercream">
        <div className="max-w-container mx-auto px-6 py-6">
          <div className="text-overline uppercase tracking-widest text-stone mb-3">
            Tracking pricing across
          </div>
          {providerSlugs.length > 0 ? (
            <Marquee
              items={providerSlugs.map((slug) => (
                <div
                  key={slug}
                  className="mx-10 flex items-center justify-center grayscale hover:grayscale-0 opacity-70 hover:opacity-100 transition-all"
                  style={{ minWidth: 80 }}
                >
                  <ProviderLogo slug={slug} variant="badge" height={32} />
                </div>
              ))}
              speed="slow"
              pauseOnHover={false}
            />
          ) : (
            <div className="h-9 text-caption text-stone">Loading providers…</div>
          )}
        </div>
      </section>

      {/* TABLE */}
      <section className="bg-parchment">
        <div className="max-w-container mx-auto px-6 py-12 md:py-16">
          {/* Title gets its own line */}
          <div className="mb-3">
            <h2 className="font-serif text-section text-nearblack">All GPUs</h2>
            <p className="text-bodysm text-olive mt-1">
              Click any row for the live chart · click a column header to sort
            </p>
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search GPU…"
              className="bg-ivory border border-bordercream rounded-xl px-3 py-2 text-bodysm focus:outline-none focus:border-focus shadow-ring"
            />
            <label className="flex items-center gap-2 text-bodysm text-olive">
              <input
                type="checkbox"
                checked={availableOnly}
                onChange={(e) => setAvailableOnly(e.target.checked)}
                className="accent-terracotta"
              />
              Available only
            </label>
          </div>

          <div className="rounded-2xl border border-bordercream bg-ivory shadow-whisper overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-5 py-3 text-overline uppercase text-stone bg-parchment border-b border-bordercream">
              <SortHeader col="col-span-3"  active={sortKey} dir={sortDir} k="name"      onSort={handleSort}>GPU</SortHeader>
              <SortHeader col="col-span-2"  active={sortKey} dir={sortDir} k="min"       onSort={handleSort}>Min / GPU</SortHeader>
              <SortHeader col="col-span-2"  active={sortKey} dir={sortDir} k="avg"       onSort={handleSort}>Avg / GPU</SortHeader>
              <SortHeader col="col-span-2"  active={sortKey} dir={sortDir} k="max"       onSort={handleSort}>Max / GPU</SortHeader>
              <div className="col-span-2">Change</div>
              <SortHeader col="col-span-1" align="right" active={sortKey} dir={sortDir} k="available" onSort={handleSort}>Avail.</SortHeader>
            </div>
            {gpusQ.isLoading && (
              <div className="px-5 py-10 text-center text-olive">Loading GPUs…</div>
            )}
            {gpusQ.isError && (
              <div className="px-5 py-10 text-center text-crimson">
                {String((gpusQ.error as Error).message)}
              </div>
            )}
            {!gpusQ.isLoading && !gpusQ.isError && gpus.length === 0 && (
              <div className="px-5 py-12 text-center text-olive">
                <div className="font-serif text-feature mb-2 text-nearblack">No data yet</div>
                <p className="text-caption text-stone max-w-md mx-auto">
                  The poller hasn't recorded any snapshots. Check the Settings page to verify your token, then click "Refresh now".
                </p>
              </div>
            )}
            {gpus.map((g) => (
              <GpuRow key={g.gpu_name} gpu={g} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function SortHeader({
  k,
  active,
  dir,
  onSort,
  col,
  align = "left",
  children,
}: {
  k: SortKey;
  active: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  col: string;
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  const isActive = active === k;
  const arrow = isActive ? (dir === "asc" ? "▲" : "▼") : "";
  return (
    <button
      type="button"
      onClick={() => onSort(k)}
      className={`${col} flex items-center gap-1 text-overline uppercase ${
        align === "right" ? "justify-end" : ""
      } ${isActive ? "text-nearblack" : "text-stone hover:text-charcoal"} transition-colors`}
    >
      <span>{children}</span>
      <span className="text-[8px] leading-none w-2">{arrow}</span>
    </button>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  // Animate the count-up if value is numeric (or a number-shaped string)
  const numeric = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d[\d,]*$/.test(value)
      ? parseInt(value.replace(/,/g, ""), 10)
      : null;
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-overline uppercase tracking-widest text-stone">{label}</span>
      <span className="font-mono text-bodysm text-nearblack">
        {numeric != null ? <CountUp value={numeric} /> : value}
      </span>
      {hint ? <span className="font-mono text-caption text-stone">{hint}</span> : null}
    </div>
  );
}

function Divider() {
  return <span className="text-stone hidden md:inline">·</span>;
}
