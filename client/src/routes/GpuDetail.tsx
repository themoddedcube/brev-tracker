import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, type HistoryRange } from "../lib/api";
import { LiveChart } from "../components/LiveChart";
import { LivePulse } from "../components/LivePulse";
import { TickerNumber } from "../components/TickerNumber";
import { ProviderLogo } from "../components/ProviderLogo";
import { fmtUsd, fmtGiB, fmtRelativeTime } from "../lib/format";

const RANGES: HistoryRange[] = ["24h", "7d", "30d", "all"];
const POSITIVE = "#7a9a4d"; // warm sage — matches DESIGN.md spirit, reads as "up"
const NEGATIVE = "#b53333"; // crimson from DESIGN.md §2

export default function GpuDetail() {
  const { name = "" } = useParams();
  const gpuName = decodeURIComponent(name);
  const [range, setRange] = useState<HistoryRange>("24h");

  // Frontend tick: refetch every 5s so the page feels live even though the
  // backend poller runs every 2min.
  const cheapestQ = useQuery({
    queryKey: ["cheapest", gpuName, range],
    queryFn: () => api.cheapest(gpuName, range),
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });
  const configsQ = useQuery({
    queryKey: ["configs", gpuName],
    queryFn: () => api.gpu(gpuName),
    refetchInterval: 30_000,
  });

  const points = cheapestQ.data?.points ?? [];
  const now = cheapestQ.data?.now ?? null;

  const stats = useMemo(() => {
    if (points.length === 0) return null;
    const prices = points.map((p) => p.price);
    const first = prices[0];
    const last = prices[prices.length - 1];
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const delta = last - first;
    const deltaPct = first > 0 ? (delta / first) * 100 : 0;
    return { first, last, min, max, delta, deltaPct };
  }, [points]);

  const isUp = stats ? stats.delta >= 0 : true;
  const accent = isUp ? POSITIVE : NEGATIVE;

  // Provider order-book (sorted ascending by price)
  const orderBook = useMemo(() => {
    const cfg = configsQ.data?.configs ?? [];
    return cfg.filter((c) => c.is_available === 1).slice(0, 12);
  }, [configsQ.data]);

  return (
    <div className="bg-parchment min-h-[calc(100vh-4rem)]">
      <div className="max-w-container mx-auto px-6 py-8">
        <Link to="/" className="text-caption text-stone hover:text-nearblack">
          ← Back to all GPUs
        </Link>

        {/* HERO: big price + change, like Binance */}
        <div className="mt-4 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-serif text-section text-nearblack leading-none">{gpuName}</h1>
              <span className="text-bodysm text-stone font-mono">/ USD/hr</span>
              <LivePulse up={isUp} tickKey={now?.fetched_at} />
            </div>
            {now ? (
              <div className="flex items-center gap-2 text-caption text-stone">
                <span>Cheapest on</span>
                <ProviderLogo slug={now.provider} variant="inline" height={16} className="text-charcoal" />
                <span>·</span>
                <span title={new Date(now.fetched_at).toLocaleString()}>
                  updated {fmtRelativeTime(now.fetched_at)}
                </span>
              </div>
            ) : (
              <div className="text-caption text-stone">No live price yet</div>
            )}
          </div>

          <div className="flex flex-col items-end">
            {now ? (
              <TickerNumber
                value={now.price}
                prefix="$"
                digits={3}
                className="text-[clamp(2.4rem,5vw,4rem)] leading-none font-serif text-nearblack"
              />
            ) : (
              <div className="text-display font-serif text-stone">—</div>
            )}
            {stats && (
              <div className="mt-2 flex items-center gap-2 text-bodysm font-num">
                <span
                  className="px-2 py-0.5 rounded-md font-medium"
                  style={{
                    color: accent,
                    background: isUp ? "rgba(122,154,77,0.10)" : "rgba(181,51,51,0.10)",
                  }}
                >
                  {isUp ? "▲" : "▼"} {fmtUsd(Math.abs(stats.delta), 4)}{" "}
                  ({stats.deltaPct >= 0 ? "+" : ""}{stats.deltaPct.toFixed(2)}%)
                </span>
                <span className="text-stone text-caption">in selected range</span>
              </div>
            )}
          </div>
        </div>

        {/* CHART CARD */}
        <div className="mt-6 rounded-2xl border border-bordercream bg-ivory shadow-whisper">
          {/* Range tabs */}
          <div className="flex items-center justify-between p-4 border-b border-bordercream">
            <div className="flex items-center gap-6 text-caption">
              {stats && (
                <>
                  <Stat label="LOW" value={fmtUsd(stats.min, 3)} />
                  <Stat label="HIGH" value={fmtUsd(stats.max, 3)} />
                  <Stat label="OPEN" value={fmtUsd(stats.first, 3)} />
                  <Stat label="LAST" value={fmtUsd(stats.last, 3)} accent={accent} />
                </>
              )}
            </div>
            <div className="flex bg-parchment rounded-xl p-1 shadow-ring">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1 text-bodysm rounded-lg transition-colors ${
                    range === r ? "bg-ivory text-nearblack shadow-ring" : "text-olive hover:text-nearblack"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="p-2">
            {cheapestQ.isLoading ? (
              <div className="h-[380px] flex items-center justify-center text-olive">Loading…</div>
            ) : (
              <LiveChart
                points={points}
                positiveColor={POSITIVE}
                negativeColor={NEGATIVE}
                height={380}
              />
            )}
          </div>
          {/* Chart footer — like Chainlink's "X data points" indicator */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-bordercream text-overline uppercase tracking-widest text-stone">
            <div className="flex items-center gap-3">
              <span>{points.length} data {points.length === 1 ? "point" : "points"}</span>
              {points.length < 5 && (
                <span className="text-terracotta normal-case font-mono normal-tracking">
                  · range filling in (poller runs every 2 min)
                </span>
              )}
            </div>
            <span className="font-mono normal-case">
              source · getdeploying.com {points.length > 0 ? "+ wayback" : ""}
            </span>
          </div>
        </div>

        {/* ORDER BOOK (cheapest providers) */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-2xl border border-bordercream bg-ivory shadow-whisper">
            <div className="px-5 py-3 border-b border-bordercream flex items-center justify-between">
              <h2 className="font-serif text-feature text-nearblack">Cheapest right now</h2>
              <span className="text-caption text-stone">
                {configsQ.data?.configs.length ?? 0} configurations
              </span>
            </div>
            <div className="grid grid-cols-12 gap-3 px-5 py-2 text-overline uppercase text-stone bg-parchment">
              <div className="col-span-3">Provider</div>
              <div className="col-span-4">Configuration</div>
              <div className="col-span-2 text-right">$/GPU·hr</div>
              <div className="col-span-2 text-right">Total</div>
              <div className="col-span-1 text-right">GPUs</div>
            </div>
            {orderBook.length === 0 && (
              <div className="px-5 py-8 text-center text-olive text-bodysm">No live listings yet.</div>
            )}
            {orderBook.map((c, i) => {
              // Subtle bar visualization: cheaper rows have a longer "depth" bar
              const cheapest = orderBook[0]?.price_per_gpu ?? c.price_per_gpu;
              const ratio = cheapest > 0 ? cheapest / c.price_per_gpu : 1;
              return (
                <div
                  key={c.type}
                  className="relative grid grid-cols-12 gap-3 px-5 py-2.5 border-t border-bordercream items-center"
                >
                  <div
                    className="absolute inset-y-0 left-0 pointer-events-none"
                    style={{
                      width: `${ratio * 100}%`,
                      background: i === 0 ? "rgba(122,154,77,0.06)" : "rgba(193,193,180,0.10)",
                    }}
                  />
                  <div className="col-span-3 text-bodysm text-charcoal relative">
                    <ProviderLogo slug={c.provider} variant="inline" height={18} />
                  </div>
                  <div className="col-span-4 text-caption text-olive truncate relative" title={c.sub_location}>
                    {c.sub_location || "—"}
                  </div>
                  <div className="col-span-2 text-right font-num text-bodysm relative">
                    <span style={{ color: i === 0 ? POSITIVE : undefined }}>
                      {fmtUsd(c.price_per_gpu)}
                    </span>
                  </div>
                  <div className="col-span-2 text-right text-caption text-stone font-num relative">
                    {fmtUsd(c.price_usd_per_hr)}
                  </div>
                  <div className="col-span-1 text-right text-caption text-stone font-num relative">
                    {c.gpu_count}×
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sidebar: spec summary */}
          <div className="rounded-2xl border border-bordercream bg-ivory shadow-whisper p-5">
            <h2 className="font-serif text-feature text-nearblack mb-3">Market summary</h2>
            <SidebarRow label="Listings" value={`${configsQ.data?.configs.length ?? 0}`} />
            <SidebarRow
              label="Providers"
              value={`${new Set((configsQ.data?.configs ?? []).map((c) => c.provider)).size}`}
            />
            {orderBook[0] && (
              <SidebarRow
                label="GPU memory"
                value={fmtGiB(orderBook[0].gpu_memory_gib)}
              />
            )}
            {stats && (
              <>
                <SidebarRow label="Range low" value={fmtUsd(stats.min, 3) + "/hr"} accent={POSITIVE} />
                <SidebarRow label="Range high" value={fmtUsd(stats.max, 3) + "/hr"} accent={NEGATIVE} />
                <SidebarRow
                  label="Spread"
                  value={fmtUsd(stats.max - stats.min, 3) + "/hr"}
                />
              </>
            )}
            <SidebarRow
              label="Last tick"
              value={now ? fmtRelativeTime(now.fetched_at) : "—"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-overline uppercase tracking-widest text-stone">{label}</span>
      <span className="text-bodysm font-num text-charcoal" style={accent ? { color: accent } : undefined}>
        {value}
      </span>
    </div>
  );
}

function SidebarRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-bordercream last:border-b-0">
      <span className="text-caption text-stone">{label}</span>
      <span className="text-bodysm font-num" style={accent ? { color: accent } : undefined}>
        {value}
      </span>
    </div>
  );
}
