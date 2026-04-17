import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  hint,
  tone = "light",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "light" | "dark";
}) {
  const surface =
    tone === "dark"
      ? "bg-darksurface border-darksurface text-silver"
      : "bg-ivory border-bordercream text-nearblack";
  return (
    <div className={`rounded-2xl border ${surface} px-5 py-4 shadow-whisper`}>
      <div className="text-overline uppercase tracking-wide text-stone">{label}</div>
      <div className="font-serif text-feature mt-1 font-num">{value}</div>
      {hint != null && <div className="text-caption text-stone mt-1">{hint}</div>}
    </div>
  );
}
