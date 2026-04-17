import { useEffect, useRef } from "react";
import uPlot from "uplot";
import { palette } from "../lib/design";

export type LivePoint = { t: number; price: number };

// A Binance/Polymarket-style single-line area chart.
// - One series, gradient fill underneath
// - Axis labels minimal, warm-toned
// - Tooltip on hover shows time + price
// - Color flips based on whether last price > first price
export function LiveChart({
  points,
  height = 380,
  positiveColor = "#7a9a4d",
  negativeColor = "#b53333",
}: {
  points: LivePoint[];
  height?: number;
  positiveColor?: string;
  negativeColor?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    plotRef.current?.destroy();

    if (points.length < 2) {
      el.innerHTML = "";
      return;
    }

    const xs = points.map((p) => Math.floor(p.t / 1000));
    const ys = points.map((p) => p.price);
    const first = ys[0];
    const last = ys[ys.length - 1];
    const isUp = last >= first;
    const stroke = isUp ? positiveColor : negativeColor;
    const fillRgb = isUp ? "122,154,77" : "181,51,51";

    const opts: uPlot.Options = {
      width: el.clientWidth,
      height,
      padding: [16, 16, 8, 8],
      legend: { show: false },
      cursor: {
        drag: { x: true, y: false },
        points: { size: 10, fill: stroke, stroke: "#fff" },
      },
      scales: {
        x: { time: true },
        y: {
          auto: true,
          range: (_u, dmin, dmax) => {
            const pad = (dmax - dmin) * 0.20 || Math.max(dmax * 0.05, 0.001);
            return [Math.max(0, dmin - pad), dmax + pad];
          },
        },
      },
      axes: [
        {
          stroke: palette.stone,
          grid: { show: false },
          ticks: { show: false },
          font: '11px Inter, system-ui, sans-serif',
          space: 90,
        },
        {
          stroke: palette.stone,
          grid: { stroke: "rgba(135,134,127,0.10)", width: 1 },
          ticks: { show: false },
          font: '11px Inter, system-ui, sans-serif',
          values: (_u, splits) => splits.map((v) => `$${v.toFixed(v < 1 ? 3 : 2)}`),
          size: 60,
          side: 1,
        },
      ],
      series: [
        {},
        {
          stroke,
          width: 2.5,
          points: {
            show: points.length < 60,
            size: 5,
            stroke,
            fill: palette.parchment,
          },
          spanGaps: true,
          fill: (u) => {
            const ctx = u.ctx;
            const grad = ctx.createLinearGradient(0, u.bbox.top, 0, u.bbox.top + u.bbox.height);
            grad.addColorStop(0, `rgba(${fillRgb}, 0.40)`);
            grad.addColorStop(0.7, `rgba(${fillRgb}, 0.08)`);
            grad.addColorStop(1, `rgba(${fillRgb}, 0)`);
            return grad;
          },
        },
      ],
      hooks: {
        draw: [
          (u) => {
            // Draw a subtle horizontal line at the latest price
            const ctx = u.ctx;
            const yPos = u.valToPos(last, "y", true);
            const left = u.bbox.left;
            const right = left + u.bbox.width;
            ctx.save();
            ctx.strokeStyle = stroke;
            ctx.globalAlpha = 0.25;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(left, yPos);
            ctx.lineTo(right, yPos);
            ctx.stroke();
            ctx.restore();

            // Pulsing dot at the rightmost point
            const xPos = u.valToPos(xs[xs.length - 1], "x", true);
            ctx.save();
            ctx.fillStyle = stroke;
            ctx.beginPath();
            ctx.arc(xPos, yPos, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 0.25;
            ctx.beginPath();
            ctx.arc(xPos, yPos, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          },
        ],
      },
    };

    plotRef.current = new uPlot(opts, [xs, ys], el);

    const handleResize = () => {
      if (!el || !plotRef.current) return;
      plotRef.current.setSize({ width: el.clientWidth, height });
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      plotRef.current?.destroy();
      plotRef.current = null;
    };
  }, [points, height, positiveColor, negativeColor]);

  if (points.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-olive bg-ivory rounded-xl"
        style={{ height }}
      >
        <div className="text-center px-6">
          <div className="font-serif text-feature mb-2">Waiting for the next tick…</div>
          <p className="text-caption text-stone max-w-md mx-auto">
            The poller is collecting price snapshots every 2 minutes. The chart will start drawing once we have at least two data points in this range.
          </p>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="w-full" />;
}
