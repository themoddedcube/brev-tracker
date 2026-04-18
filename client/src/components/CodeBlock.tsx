import { useState } from "react";

export function CodeBlock({
  code,
  lang = "bash",
  className = "",
}: {
  code: string;
  lang?: "bash" | "json" | "python" | "typescript" | "text";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className={`relative group ${className}`}>
      <pre className="rounded-xl border border-bordercream bg-nearblack text-silver overflow-x-auto p-4 text-bodysm font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
      <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-overline uppercase tracking-widest text-stone bg-darksurface px-2 py-1 rounded-md">
          {lang}
        </span>
        <button
          onClick={copy}
          className="text-overline uppercase tracking-widest bg-darksurface text-silver hover:bg-charcoal px-2 py-1 rounded-md"
        >
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
    </div>
  );
}
