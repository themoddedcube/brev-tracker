import { useEffect, useRef } from "react";
import uPlot from "uplot";
import { colorFor, palette } from "../lib/design";
import { providerLabel } from "../lib/format";

export type ChartSeries = { provider: string; prices: (number | null)[] };

export function PriceChart({
  t,
  series,
  height = 360,
}: {
  t: number[]; // unix seconds
  series: ChartSeries[];
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    plotRef.current?.destroy();

    if (t.length < 2 || series.length === 0) {
      containerRef.current.innerHTML = "";
      return;
    }

    const data: uPlot.AlignedData = [t, ...series.map((s) => s.prices as (number | null)[])];

    const seriesOpts: uPlot.Series[] = [
      {},
      ...series.map((s, i) => ({
        label: providerLabel(s.provider),
        stroke: colorFor(i),
        width: 1.8,
        points: { show: t.length < 60, size: 3, stroke: colorFor(i), fill: palette.parchment },
        spanGaps: true,
        value: (_u: uPlot, v: number | null) => (v == null ? "—" : `$${v.toFixed(3)}/hr`),
      })),
    ];

    const opts: uPlot.Options = {
      width: containerRef.current.clientWidth,
      height,
      padding: [12, 16, 8, 8],
      legend: { show: true, live: true },
      cursor: { drag: { x: true, y: false } },
      scales: {
        x: { time: true },
        y: { auto: true, range: (_, dmin, dmax) => [Math.max(0, dmin * 0.95), dmax * 1.05] },
      },
      axes: [
        {
          stroke: palette.stone,
          grid: { stroke: palette.bordercream, width: 1 },
          ticks: { stroke: palette.bordercream, width: 1 },
          font: '12px Inter, system-ui, sans-serif',
        },
        {
          stroke: palette.stone,
          grid: { stroke: palette.bordercream, width: 1 },
          ticks: { stroke: palette.bordercream, width: 1 },
          font: '12px Inter, system-ui, sans-serif',
          values: (_u, splits) => splits.map((v) => `$${v.toFixed(2)}`),
          size: 60,
        },
      ],
      series: seriesOpts,
    };

    plotRef.current = new uPlot(opts, data, containerRef.current);

    const handleResize = () => {
      if (!containerRef.current || !plotRef.current) return;
      plotRef.current.setSize({ width: containerRef.current.clientWidth, height });
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      plotRef.current?.destroy();
      plotRef.current = null;
    };
  }, [t, series, height]);

  if (t.length < 2) {
    return (
      <div
        className="rounded-2xl border border-bordercream bg-ivory p-10 text-center text-olive"
        style={{ height }}
      >
        <div className="font-serif text-feature mb-2">Collecting data…</div>
        <p className="text-caption text-stone">
          Need at least two snapshots to draw a trend. The poller runs on the cron schedule, or you can hit "Refresh now" on Settings (after the 60s throttle).
        </p>
      </div>
    );
  }
  return <div ref={containerRef} className="w-full" />;
}
