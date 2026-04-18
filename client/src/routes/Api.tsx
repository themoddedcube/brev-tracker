import { useEffect, useState } from "react";
import { Endpoint, useActiveAnchor } from "../components/Endpoint";
import { CodeBlock } from "../components/CodeBlock";

const ENDPOINTS = [
  { id: "ep-cheapest", label: "GET /v1/cheapest" },
  { id: "ep-best",     label: "GET /v1/best" },
  { id: "ep-search",   label: "GET /v1/search" },
  { id: "ep-gpus",     label: "GET /v1/gpus" },
  { id: "ep-gpu",      label: "GET /v1/gpus/{name}" },
  { id: "ep-history",  label: "GET /v1/gpus/{name}/history" },
  { id: "ep-quote",    label: "GET /v1/gpus/{name}/quote" },
  { id: "ep-movers",   label: "GET /v1/movers" },
  { id: "ep-providers", label: "GET /v1/providers" },
  { id: "ep-health",   label: "GET /v1/health" },
  { id: "ep-meta",     label: "OpenAPI + llms.txt" },
];

export default function Api() {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const active = useActiveAnchor(ENDPOINTS.map((e) => e.id));
  const [snapshotCount, setSnapshotCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/v1/health")
      .then((r) => r.json())
      .then((j) => setSnapshotCount(j.snapshot_count ?? null))
      .catch(() => {});
  }, []);

  return (
    <>
      {/* HERO */}
      <section className="bg-parchment border-b border-bordercream relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none animate-glow-drift"
          style={{
            background:
              "radial-gradient(circle at 20% 30%, rgba(201,100,66,0.08) 0%, transparent 45%), radial-gradient(circle at 75% 70%, rgba(217,119,87,0.06) 0%, transparent 50%)",
          }}
        />
        <div className="relative max-w-container mx-auto px-6 pt-16 pb-10 md:pt-20 md:pb-12 animate-fade-up">
          <div className="text-overline uppercase tracking-widest text-terracotta mb-3">
            Public API · v1 · free, no auth
          </div>
          <h1 className="font-serif text-display text-nearblack max-w-4xl">
            Pipe live GPU prices<br />into anything.
          </h1>
          <p className="text-bodylarge text-olive mt-6 max-w-2xl">
            A free, open, real-time HTTP API for GPU pricing across every cloud Brev runs on. Built for autonomous agents, cost-aware schedulers, and tools that need to pick the cheapest GPU at any moment.
          </p>

          {/* Quick facts */}
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-bodysm">
            <Fact label="Base URL" value={baseUrl} mono />
            <Fact label="Auth" value="none" />
            <Fact label="CORS" value="open to all origins" />
            <Fact label="Format" value="JSON · UTF-8" />
            <Fact label="Update cadence" value="every 2 minutes" />
            {snapshotCount != null && <Fact label="Snapshots collected" value={snapshotCount.toLocaleString()} />}
          </div>
        </div>
      </section>

      {/* DOCS BODY */}
      <section className="bg-parchment">
        <div className="max-w-container mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-10">
          {/* Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-1">
              <div className="text-overline uppercase tracking-widest text-stone mb-3">
                Endpoints
              </div>
              {ENDPOINTS.map((e) => (
                <a
                  key={e.id}
                  href={`#${e.id}`}
                  className={`block text-bodysm font-mono py-1 transition-colors ${
                    active === e.id ? "text-terracotta" : "text-olive hover:text-nearblack"
                  }`}
                >
                  {e.label}
                </a>
              ))}
              <div className="pt-6 mt-6 border-t border-bordercream space-y-1">
                <a href="#agents" className="block text-bodysm font-mono py-1 text-olive hover:text-nearblack">
                  Agent integration
                </a>
                <a href="#examples" className="block text-bodysm font-mono py-1 text-olive hover:text-nearblack">
                  Code examples
                </a>
              </div>
            </div>
          </aside>

          {/* Main */}
          <div className="space-y-6 min-w-0">
            <Endpoint
              id="ep-cheapest"
              path="/v1/cheapest"
              summary="One row per GPU showing the cheapest available config right now"
              description="The best entry point for autonomous agents. Returns one row per GPU type with the cheapest available provider, fully filterable. Pricing is normalized to USD per GPU per hour."
              params={[
                { name: "available_only", type: "boolean", description: "Default true. Only return live listings." },
                { name: "min_vram", type: "number", description: "GiB per GPU." },
                { name: "max_price", type: "number", description: "USD/hr per GPU." },
                { name: "provider", type: "string", description: "Filter by provider slug, e.g. lambda-labs." },
                { name: "gpu_count", type: "integer", description: "Exact GPU count per instance." },
              ]}
              exampleQuery="min_vram=24&max_price=2"
              exampleResponse={{
                count: 12,
                gpus: [
                  {
                    gpu_name: "T4",
                    provider: "vast-ai",
                    config_name: "1x T4 16GB",
                    gpu_count: 1,
                    gpu_memory_gib: 16,
                    vcpu: 8,
                    memory_gib: 32,
                    price_per_gpu: 0.1477,
                    price_total_per_hr: 0.1477,
                    is_available: 1,
                    region: "",
                  },
                ],
              }}
            />

            <Endpoint
              id="ep-best"
              path="/v1/best"
              summary="Pick the single cheapest config matching your filters"
              description="Use this when an agent has decided what it needs (e.g. 'an H100 with 80+ GiB VRAM under $2.50/hr') and just wants the answer. Returns a single match object."
              params={[
                { name: "gpu", type: "string", description: "GPU model. Omit to search the entire catalog." },
                { name: "min_vram", type: "number", description: "GiB per GPU." },
                { name: "max_price", type: "number", description: "USD/hr per GPU." },
                { name: "provider", type: "string", description: "Constrain to one provider." },
                { name: "min_gpu_count", type: "integer", description: "Minimum GPUs per instance." },
                { name: "available_only", type: "boolean", description: "Default true." },
              ]}
              exampleQuery="gpu=H100&min_vram=80&max_price=2.50"
              exampleResponse={{
                match: {
                  gpu_name: "H100",
                  provider: "thunder-compute",
                  config_name: "1x H100 80GB PCIe",
                  gpu_count: 1,
                  gpu_memory_gib: 80,
                  vcpu: 4,
                  memory_gib: 32,
                  price_per_gpu: 1.38,
                  price_total_per_hr: 1.38,
                  is_available: 1,
                  region: "",
                },
                matched_at: "2026-04-18T10:00:00.000Z",
              }}
            />

            <Endpoint
              id="ep-search"
              path="/v1/search"
              summary="Filter the entire catalog flexibly"
              params={[
                { name: "gpu", type: "string", description: "GPU model." },
                { name: "min_vram", type: "number", description: "GiB per GPU." },
                { name: "max_price", type: "number", description: "USD/hr per GPU." },
                { name: "provider", type: "string", description: "Provider slug." },
                { name: "min_gpu_count", type: "integer", description: "" },
                { name: "max_gpu_count", type: "integer", description: "" },
                { name: "available_only", type: "boolean", description: "Default true." },
                { name: "limit", type: "integer", description: "Default 100, max 500." },
              ]}
              exampleQuery="gpu=A100&min_gpu_count=4&limit=10"
            />

            <Endpoint
              id="ep-gpus"
              path="/v1/gpus"
              summary="List every tracked GPU model with min/avg/max + 24h % change"
              exampleResponse={{
                count: 22,
                gpus: [
                  {
                    gpu_name: "H100",
                    providers: 36,
                    configs: 119,
                    available: 70,
                    min_price_per_gpu: 1.38,
                    avg_price_per_gpu: 3.12,
                    max_price_per_gpu: 12.5,
                    gpu_memory_gib_min: 80,
                    gpu_memory_gib_max: 80,
                    change_pct_24h: -2.4,
                  },
                ],
              }}
            />

            <Endpoint
              id="ep-gpu"
              path="/v1/gpus/{name}"
              summary="Cheapest config + every provider listing for one GPU"
              params={[{ name: "name", type: "string", required: true, description: "GPU display name (e.g. H100)." }]}
              exampleQuery=""
            />

            <Endpoint
              id="ep-history"
              path="/v1/gpus/{name}/history"
              summary="Time series of the cheapest available price for one GPU"
              params={[
                { name: "name", type: "string", required: true, description: "GPU display name." },
                { name: "range", type: "string", description: "24h | 7d | 30d | all. Default 7d." },
              ]}
              exampleQuery="range=24h"
            />

            <Endpoint
              id="ep-quote"
              path="/v1/gpus/{name}/quote"
              summary="Live ranked provider quotes for one GPU"
              description="Returns every available config sorted by price-per-GPU ascending. The 'order book' for a GPU."
              params={[
                { name: "name", type: "string", required: true, description: "GPU display name." },
                { name: "available_only", type: "boolean", description: "Default true." },
              ]}
            />

            <Endpoint
              id="ep-movers"
              path="/v1/movers"
              summary="GPUs with the biggest price moves over a window"
              params={[
                { name: "window", type: "string", description: "1h | 24h | 7d | 30d. Default 24h." },
                { name: "limit", type: "integer", description: "Default 20, max 100." },
              ]}
              exampleQuery="window=24h&limit=10"
            />

            <Endpoint
              id="ep-providers"
              path="/v1/providers"
              summary="Provider summary with logos + stats"
            />

            <Endpoint
              id="ep-health"
              path="/v1/health"
              summary="Tracker status: last poll, snapshot count, source"
            />

            <section id="ep-meta" className="rounded-2xl border border-bordercream bg-ivory shadow-whisper p-6">
              <h2 className="font-serif text-feature text-nearblack mb-2">Machine-readable docs</h2>
              <p className="text-bodysm text-olive mb-4">
                Two ways to feed this API into LLM tool-calling frameworks or SDK generators:
              </p>
              <div className="space-y-3 text-bodysm">
                <a href="/v1/openapi.json" className="block group">
                  <div className="font-mono text-charcoal group-hover:text-terracotta">GET /v1/openapi.json</div>
                  <div className="text-stone text-caption">OpenAPI 3.1 spec — drop into Swagger, Redoc, openapi-generator, openai/anthropic tool definitions.</div>
                </a>
                <a href="/v1/llms.txt" className="block group">
                  <div className="font-mono text-charcoal group-hover:text-terracotta">GET /v1/llms.txt</div>
                  <div className="text-stone text-caption">Plain-text API description optimized for LLM context windows. Drop the contents directly into a system prompt.</div>
                </a>
              </div>
            </section>

            {/* Agent integration */}
            <section id="agents" className="rounded-2xl border border-bordercream bg-ivory shadow-whisper p-6 scroll-mt-24">
              <h2 className="font-serif text-feature text-nearblack mb-2">Built for autonomous agents</h2>
              <p className="text-bodysm text-olive mb-4">
                The intended use case is letting an LLM-driven scheduler pick the cheapest GPU at any moment. Two patterns work well:
              </p>
              <div className="space-y-4">
                <div>
                  <div className="text-overline uppercase tracking-widest text-stone mb-2">Pattern 1 · Tool calling</div>
                  <p className="text-bodysm text-olive mb-2">
                    Hand the LLM a single tool definition wrapping <code className="font-mono text-charcoal">/v1/best</code>. The model passes filters, gets back one config, hands it to your launch code.
                  </p>
                  <CodeBlock
                    lang="python"
                    code={`from anthropic import Anthropic

tools = [{
    "name": "pick_gpu",
    "description": "Pick the cheapest GPU matching workload requirements.",
    "input_schema": {
        "type": "object",
        "properties": {
            "gpu":           {"type": "string"},
            "min_vram":      {"type": "number", "description": "GiB per GPU"},
            "max_price":     {"type": "number", "description": "USD/hr per GPU"},
            "min_gpu_count": {"type": "integer"},
            "provider":      {"type": "string"},
        },
    },
}]

# When the model calls pick_gpu(...), forward it to:
import httpx
r = httpx.get("${baseUrl}/v1/best", params=tool_input)
match = r.json()["match"]
# → use match.provider, match.price_per_gpu, match.config_name`}
                  />
                </div>
                <div>
                  <div className="text-overline uppercase tracking-widest text-stone mb-2">Pattern 2 · System-prompt context</div>
                  <p className="text-bodysm text-olive mb-2">
                    Just inline <code className="font-mono text-charcoal">/v1/llms.txt</code> at the top of your system prompt. The model knows the entire surface area without per-request tool definitions.
                  </p>
                </div>
              </div>
            </section>

            {/* Examples */}
            <section id="examples" className="rounded-2xl border border-bordercream bg-ivory shadow-whisper p-6 scroll-mt-24">
              <h2 className="font-serif text-feature text-nearblack mb-4">Code examples</h2>
              <div className="space-y-5">
                <div>
                  <div className="text-overline uppercase tracking-widest text-stone mb-2">curl</div>
                  <CodeBlock
                    lang="bash"
                    code={`# Cheapest H100 with 80+ GiB VRAM under $2.50/hr
curl "${baseUrl}/v1/best?gpu=H100&min_vram=80&max_price=2.50"`}
                  />
                </div>
                <div>
                  <div className="text-overline uppercase tracking-widest text-stone mb-2">JavaScript / TypeScript</div>
                  <CodeBlock
                    lang="typescript"
                    code={`const res = await fetch("${baseUrl}/v1/best?gpu=H100&min_vram=80&max_price=2.5");
const { match } = await res.json();
console.log(\`Use \${match.provider} at $\${match.price_per_gpu}/hr\`);`}
                  />
                </div>
                <div>
                  <div className="text-overline uppercase tracking-widest text-stone mb-2">Python</div>
                  <CodeBlock
                    lang="python"
                    code={`import httpx

r = httpx.get("${baseUrl}/v1/best", params={
    "gpu": "H100", "min_vram": 80, "max_price": 2.50
})
match = r.json()["match"]
print(f"Use {match['provider']} at \${match['price_per_gpu']:.3f}/hr")`}
                  />
                </div>
                <div>
                  <div className="text-overline uppercase tracking-widest text-stone mb-2">OpenAI tool definition (drop-in)</div>
                  <CodeBlock
                    lang="json"
                    code={JSON.stringify(
                      {
                        type: "function",
                        function: {
                          name: "find_cheapest_gpu",
                          description:
                            "Find the cheapest cloud GPU matching the workload's requirements across all of Brev's underlying providers.",
                          parameters: {
                            type: "object",
                            properties: {
                              gpu: { type: "string", description: "GPU model name e.g. H100, A100, L40S" },
                              min_vram: { type: "number", description: "Minimum VRAM per GPU in GiB" },
                              max_price: { type: "number", description: "Maximum USD per GPU per hour" },
                              min_gpu_count: { type: "integer" },
                              provider: { type: "string" },
                            },
                          },
                        },
                      },
                      null,
                      2,
                    )}
                  />
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>
    </>
  );
}

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-overline uppercase tracking-widest text-stone">{label}</span>
      <span className={`text-bodysm text-nearblack ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
