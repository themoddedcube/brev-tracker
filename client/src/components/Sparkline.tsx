import { useEffect, useRef } from "react";
import uPlot from "uplot";
import { palette } from "../lib/design";

export function Sparkline({
  points,
  width = 120,
  height = 30,
  color = palette.terracotta,
}: {
  points: { t: number; price: number }[];
  width?: number;
  height?: number;
  color?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    plotRef.current?.destroy();

    if (points.length < 2) {
      ref.current.innerHTML = "";
      return;
    }

    const xs = points.map((p) => Math.floor(p.t / 1000));
    const ys = points.map((p) => p.price);

    const opts: uPlot.Options = {
      width,
      height,
      padding: [2, 2, 2, 2],
      cursor: { show: false },
      legend: { show: false },
      scales: {
        x: { time: true },
        y: { auto: true },
      },
      axes: [
        { show: false },
        { show: false },
      ],
      series: [
        {},
        {
          stroke: color,
          width: 1.5,
          points: { show: false },
        },
      ],
    };

    plotRef.current = new uPlot(opts, [xs, ys], ref.current);
    return () => {
      plotRef.current?.destroy();
      plotRef.current = null;
    };
  }, [points, width, height, color]);

  if (points.length < 2) {
    return <div className="text-caption text-stone">—</div>;
  }
  return <div ref={ref} style={{ width, height }} />;
}
