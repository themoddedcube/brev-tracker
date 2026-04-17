import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api";
import { providerLabel } from "../lib/format";

// Cached query — pulled once per session, refetched only after 5 min.
export function useProviderLookup() {
  return useQuery({
    queryKey: ["providers-lookup"],
    queryFn: api.providersLookup,
    staleTime: 5 * 60 * 1000,
  });
}

// Renders a provider as <logo> + label, or just the label if no logo.
// Variants:
//   - inline (default): small logo next to text label
//   - badge: bigger logo only, label as tooltip (for marquees)
//   - text: no logo, just label
export function ProviderLogo({
  slug,
  variant = "inline",
  height = 18,
  className = "",
}: {
  slug: string;
  variant?: "inline" | "badge" | "text";
  height?: number;
  className?: string;
}) {
  const lookupQ = useProviderLookup();
  const info = lookupQ.data?.providers[slug];
  const label = info?.label ?? providerLabel(slug);
  const logo = info?.logo_url ?? null;
  const [imgFailed, setImgFailed] = useState(false);

  if (variant === "text" || !logo || imgFailed) {
    return <span className={className}>{label}</span>;
  }

  if (variant === "badge") {
    return (
      <img
        src={logo}
        alt={label}
        title={label}
        height={height}
        loading="lazy"
        onError={() => setImgFailed(true)}
        className={`object-contain ${className}`}
        style={{ height, width: "auto", maxWidth: height * 5 }}
      />
    );
  }

  // inline
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src={logo}
        alt=""
        height={height}
        loading="lazy"
        onError={() => setImgFailed(true)}
        className="object-contain"
        style={{ height, width: "auto", maxWidth: height * 4 }}
      />
      <span>{label}</span>
    </span>
  );
}
