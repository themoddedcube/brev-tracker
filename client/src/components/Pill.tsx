import type { ReactNode } from "react";

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "muted" | "dark" | "warn";
}) {
  const styles: Record<string, string> = {
    neutral: "bg-sand text-charcoal shadow-ring",
    muted: "bg-bordercream text-olive",
    brand: "bg-terracotta text-ivory",
    dark: "bg-nearblack text-silver",
    warn: "bg-crimson/10 text-crimson",
  };
  return (
    <span
      className={`inline-flex items-center rounded-3xl px-2.5 py-0.5 text-label ${styles[tone]}`}
    >
      {children}
    </span>
  );
}
