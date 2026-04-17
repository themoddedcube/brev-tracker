import type { ReactNode } from "react";

export function Section({
  tone = "light",
  children,
  className = "",
}: {
  tone?: "light" | "dark";
  children: ReactNode;
  className?: string;
}) {
  const bg = tone === "dark" ? "bg-nearblack text-silver" : "bg-parchment text-nearblack";
  return (
    <section className={`${bg} ${className}`}>
      <div className="max-w-container mx-auto px-6 py-12 md:py-20">{children}</div>
    </section>
  );
}
