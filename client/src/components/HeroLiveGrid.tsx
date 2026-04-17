import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Sparkline } from "./Sparkline";
import { ProviderLogo } from "./ProviderLogo";
import { fmtUsd } from "../lib/format";

const POSITIVE = "#7a9a4d";
const NEGATIVE = "#b53333";

const HEADLINE_GPUS = ["H100", "A100", "H200", "B200"];

export function HeroLiveGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 w-full max-w-md">
      {HEADLINE_GPUS.map((g) => (
        <MiniTicker key={g} gpu={g} />
      ))}
    </div>
  );
}

function MiniTicker({ gpu }: { gpu: string }) {
  const q = useQuery({
    queryKey: ["mini-cheapest", gpu],
    queryFn: () => api.cheapest(gpu, "30d"),
    refetchInterval: 10_000,
  });

  const stats = useMemo(() => {
    const points = q.data?.points ?? [];
    if (points.length === 0) return null;
    const first = points[0].price;
    const last = points[points.length - 1].price;
    const delta = last - first;
    const deltaPct = first > 0 ? (delta / first) * 100 : 0;
    return { first, last, delta, deltaPct };
  }, [q.data]);

  const now = q.data?.now ?? null;
  const isUp = stats ? stats.delta >= 0 : true;
  const accent = isUp ? POSITIVE : NEGATIVE;
  const points = (q.data?.points ?? []).map((p) => ({ t: p.t, price: p.price }));

  return (
    <Link
      to={`/gpu/${encodeURIComponent(gpu)}`}
      className="rounded-2xl border border-bordercream bg-ivory px-3 py-3 hover:shadow-whisper hover:-translate-y-0.5 hover:border-ringwarm transition-all duration-200 group"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-serif text-feature text-nearblack leading-none">{gpu}</span>
        {stats && (
          <span
            className="text-caption font-num font-medium px-1.5 py-0.5 rounded-md"
            style={{
              color: accent,
              background: isUp ? "rgba(122,154,77,0.10)" : "rgba(181,51,51,0.10)",
            }}
          >
            {isUp ? "▲" : "▼"} {Math.abs(stats.deltaPct).toFixed(1)}%
          </span>
        )}
      </div>
      {now ? (
        <div className="font-num text-bodylarge text-nearblack leading-tight">
          {fmtUsd(now.price)}
          <span className="text-caption text-stone">/hr</span>
        </div>
      ) : (
        <div className="font-num text-bodylarge text-stone leading-tight">—</div>
      )}
      <div className="mt-1 -mx-1">
        <Sparkline points={points} width={170} height={34} color={accent} />
      </div>
      {now && (
        <div className="mt-1 flex items-center gap-1 text-overline uppercase tracking-widest text-stone">
          <ProviderLogo slug={now.provider} variant="badge" height={12} />
        </div>
      )}
    </Link>
  );
}
