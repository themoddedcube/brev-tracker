export function fmtUsd(n: number | null | undefined, digits = 3): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(digits)}`;
}

export function fmtUsdPerHr(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${fmtUsd(n)}/hr`;
}

export function fmtGiB(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1024) return `${(n / 1024).toFixed(1)} TiB`;
  return `${Math.round(n)} GiB`;
}

export function fmtRelativeTime(ms: number | null | undefined): string {
  if (!ms) return "never";
  const diff = Date.now() - ms;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

export function fmtAbsTime(ms: number | null | undefined): string {
  if (!ms) return "—";
  const d = new Date(ms);
  return d.toLocaleString();
}

export function providerLabel(p: string): string {
  const m: Record<string, string> = {
    aws: "AWS",
    gcp: "GCP",
    "lambda-labs": "Lambda",
    crusoe: "Crusoe",
    nebius: "Nebius",
    shadeform: "Shadeform",
    launchpad: "Launchpad",
    sfcompute: "SF Compute",
  };
  return m[p] ?? p;
}
