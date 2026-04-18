import { useEffect, useState } from "react";
import { CodeBlock } from "./CodeBlock";

type Param = { name: string; type: string; required?: boolean; description: string };

export function Endpoint({
  id,
  method = "GET",
  path,
  summary,
  description,
  params = [],
  exampleResponse,
  exampleQuery = "",
}: {
  id: string;
  method?: "GET" | "POST";
  path: string;
  summary: string;
  description?: string;
  params?: Param[];
  exampleResponse?: unknown;
  exampleQuery?: string;
}) {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const fullPath = path + (exampleQuery ? `?${exampleQuery}` : "");
  const fullUrl = baseUrl + fullPath;

  const [tryResult, setTryResult] = useState<{ ok: boolean; status: number; body: string; ms: number } | null>(null);
  const [trying, setTrying] = useState(false);

  async function tryIt() {
    setTrying(true);
    setTryResult(null);
    const start = performance.now();
    try {
      const res = await fetch(fullUrl, { method });
      const text = await res.text();
      let pretty = text;
      try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch {}
      setTryResult({ ok: res.ok, status: res.status, body: pretty, ms: Math.round(performance.now() - start) });
    } catch (err) {
      setTryResult({ ok: false, status: 0, body: String(err), ms: Math.round(performance.now() - start) });
    } finally {
      setTrying(false);
    }
  }

  return (
    <section id={id} className="rounded-2xl border border-bordercream bg-ivory shadow-whisper p-6 scroll-mt-24">
      <header className="flex flex-wrap items-center gap-3 mb-2">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-overline uppercase tracking-widest font-mono ${
            method === "GET" ? "bg-sand text-charcoal" : "bg-terracotta text-ivory"
          }`}
        >
          {method}
        </span>
        <code className="font-mono text-bodysm text-nearblack break-all">{path}</code>
      </header>
      <h3 className="font-serif text-feature text-nearblack mt-2">{summary}</h3>
      {description && <p className="text-bodysm text-olive mt-2">{description}</p>}

      {params.length > 0 && (
        <div className="mt-5">
          <div className="text-overline uppercase tracking-widest text-stone mb-2">Parameters</div>
          <div className="rounded-xl border border-bordercream overflow-hidden">
            <table className="w-full text-bodysm">
              <thead className="bg-parchment">
                <tr className="text-overline uppercase tracking-widest text-stone">
                  <th className="text-left px-3 py-2 font-normal">Name</th>
                  <th className="text-left px-3 py-2 font-normal">Type</th>
                  <th className="text-left px-3 py-2 font-normal">Required</th>
                  <th className="text-left px-3 py-2 font-normal">Description</th>
                </tr>
              </thead>
              <tbody>
                {params.map((p) => (
                  <tr key={p.name} className="border-t border-bordercream">
                    <td className="px-3 py-2 font-mono text-charcoal">{p.name}</td>
                    <td className="px-3 py-2 font-mono text-stone">{p.type}</td>
                    <td className="px-3 py-2 text-stone">{p.required ? "yes" : "no"}</td>
                    <td className="px-3 py-2 text-charcoal">{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-overline uppercase tracking-widest text-stone">Request</div>
            <button
              onClick={tryIt}
              disabled={trying}
              className="text-overline uppercase tracking-widest bg-terracotta text-ivory hover:bg-coral px-3 py-1 rounded-md disabled:bg-stone"
            >
              {trying ? "Running…" : "Run live ↗"}
            </button>
          </div>
          <CodeBlock lang="bash" code={`curl ${fullUrl}`} />
        </div>
        <div>
          <div className="text-overline uppercase tracking-widest text-stone mb-2">
            {tryResult ? `Live response · ${tryResult.status} · ${tryResult.ms}ms` : "Example response"}
          </div>
          <CodeBlock
            lang="json"
            code={
              tryResult
                ? tryResult.body.slice(0, 4000) + (tryResult.body.length > 4000 ? "\n…(truncated)" : "")
                : exampleResponse
                  ? JSON.stringify(exampleResponse, null, 2)
                  : "{}"
            }
          />
        </div>
      </div>
    </section>
  );
}

// Auto-scroll spy: highlight the active endpoint in the sidebar.
export function useActiveAnchor(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [ids.join(",")]);
  return active;
}
