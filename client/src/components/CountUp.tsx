import { useEffect, useRef, useState } from "react";

// Animates a number from 0 → value with an ease-out cubic curve.
// Re-runs whenever `value` changes, so a stat that updates from 1075 → 1078
// also gets a smooth tick.
export function CountUp({
  value,
  duration = 900,
  format = (n: number) => Math.round(n).toLocaleString(),
  className = "",
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    fromRef.current = display;
    startRef.current = null;

    const step = (now: number) => {
      if (startRef.current == null) startRef.current = now;
      const t = Math.min(1, (now - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = fromRef.current + (value - fromRef.current) * eased;
      setDisplay(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setDisplay(value);
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // intentionally NOT depending on display
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <span className={className}>{format(display)}</span>;
}
