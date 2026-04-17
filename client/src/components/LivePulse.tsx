import { useEffect, useState } from "react";

// A pulsing dot + "Live" label, tinted green/red based on `up`.
// When `tickKey` changes, the dot flashes.
export function LivePulse({ up = true, tickKey }: { up?: boolean; tickKey?: number | string }) {
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (tickKey === undefined) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 600);
    return () => clearTimeout(t);
  }, [tickKey]);

  const color = up ? "#7a9a4d" : "#b53333";
  return (
    <span className="inline-flex items-center gap-2 text-overline uppercase tracking-widest">
      <span className="relative inline-flex w-2.5 h-2.5">
        <span
          className={`absolute inline-flex w-full h-full rounded-full opacity-50 ${
            flash ? "animate-ping" : ""
          }`}
          style={{ background: color }}
        />
        <span
          className="relative inline-flex w-2.5 h-2.5 rounded-full"
          style={{ background: color }}
        />
      </span>
      <span style={{ color }}>LIVE</span>
    </span>
  );
}
