import { useEffect, useRef, useState } from "react";

// Animates the number on update with a brief flash + count-up.
export function TickerNumber({
  value,
  prefix = "",
  suffix = "",
  digits = 3,
  className = "",
  flashColor,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  digits?: number;
  className?: string;
  flashColor?: string;
}) {
  const [display, setDisplay] = useState(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prevRef = useRef(value);

  useEffect(() => {
    const prev = prevRef.current;
    if (prev === value) return;
    setFlash(value > prev ? "up" : "down");
    const start = performance.now();
    const dur = 350;
    const from = prev;
    const to = value;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(step);
      else {
        setDisplay(to);
        prevRef.current = to;
        setTimeout(() => setFlash(null), 250);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const flashStyle =
    flash === "up"
      ? { color: flashColor ?? "#7a9a4d" }
      : flash === "down"
      ? { color: flashColor ?? "#b53333" }
      : undefined;

  return (
    <span
      className={`font-num transition-colors duration-300 ${className}`}
      style={flashStyle}
    >
      {prefix}
      {display.toFixed(digits)}
      {suffix}
    </span>
  );
}
