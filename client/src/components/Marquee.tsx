import { type ReactNode } from "react";

// Infinite-scroll marquee. Items are duplicated so the loop is seamless.
// Uses CSS keyframes (translateX 0 → -50%) on a doubled track.
export function Marquee({
  items,
  speed = "normal",
  pauseOnHover = true,
  className = "",
}: {
  items: ReactNode[];
  speed?: "normal" | "slow";
  pauseOnHover?: boolean;
  className?: string;
}) {
  const animClass = speed === "slow" ? "animate-marquee-slow" : "animate-marquee";
  return (
    <div
      className={`group relative overflow-hidden ${className}`}
      style={{
        maskImage:
          "linear-gradient(to right, transparent 0, black 6%, black 94%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent 0, black 6%, black 94%, transparent 100%)",
      }}
    >
      <div
        className={`flex w-max ${animClass} ${
          pauseOnHover ? "group-hover:[animation-play-state:paused]" : ""
        }`}
      >
        {[...items, ...items].map((item, i) => (
          <div key={i} className="shrink-0 flex items-center">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
