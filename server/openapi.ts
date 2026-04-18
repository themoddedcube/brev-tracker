// OpenAPI 3.1 spec for the Brev Price Index public API.
// Served at /v1/openapi.json. Used by:
//   - LLM tool calling (most providers can ingest OpenAPI directly)
//   - SDK generators (openapi-generator, openapi-typescript)
//   - API documentation viewers (Swagger, Redoc, Stoplight)

export function buildOpenApiSpec(baseUrl: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Brev Price Index API",
      version: "1.0.0",
      summary: "Live GPU pricing across every cloud Brev runs on.",
      description:
        "Free, public, read-only API for real-time GPU pricing across 30+ cloud providers (AWS, GCP, Lambda, RunPod, Crusoe, Shadeform, Nebius, vast.ai, and more). Built as an integration into brev.nvidia.com for autonomous agents, cost-aware schedulers, and price-tracking dashboards. No authentication required. CORS enabled. Polls every 2 minutes.",
      contact: { name: "Brev Price Index", url: "https://brev.nvidia.com" },
      license: { name: "MIT" },
    },
    servers: [{ url: baseUrl, description: "Production" }],
    paths: {
      "/v1/gpus": {
        get: {
          operationId: "listGpus",
          summary: "List every GPU model tracked, with current min/avg/max price",
          description:
            "Returns one row per GPU model. Use this as the entry point: pick a model, then call /v1/gpus/{name} or /v1/gpus/{name}/quote for live provider rankings.",
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  example: {
                    gpus: [
                      {
                        gpu_name: "H100",
                        providers: 36,
                        configs: 119,
                        available: 70,
                        min_price_per_gpu: 1.38,
                        avg_price_per_gpu: 3.12,
                        max_price_per_gpu: 12.5,
                        change_pct_24h: -2.4,
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },
      "/v1/gpus/{name}": {
        get: {
          operationId: "getGpu",
          summary: "Current cheapest config + every provider listing for a GPU",
          parameters: [
            { name: "name", in: "path", required: true, schema: { type: "string" }, description: "GPU display name (H100, A100, H200, B200, L40S, L40, L4, A10, A40, A6000, T4, V100, MI300X, etc.)" },
          ],
          responses: { "200": { description: "OK" } },
        },
      },
      "/v1/gpus/{name}/history": {
        get: {
          operationId: "getGpuHistory",
          summary: "Time series of the cheapest price for one GPU over a range",
          parameters: [
            { name: "name", in: "path", required: true, schema: { type: "string" } },
            { name: "range", in: "query", schema: { type: "string", enum: ["24h", "7d", "30d", "all"] }, description: "Default 7d" },
          ],
          responses: { "200": { description: "OK" } },
        },
      },
      "/v1/gpus/{name}/quote": {
        get: {
          operationId: "getQuote",
          summary: "Live ranked provider quotes for a GPU — cheapest first",
          description: "The endpoint to call when you want to actually pick a provider for a workload. Returns every available config sorted by price-per-GPU ascending.",
          parameters: [
            { name: "name", in: "path", required: true, schema: { type: "string" } },
            { name: "available_only", in: "query", schema: { type: "boolean", default: true } },
          ],
          responses: { "200": { description: "OK" } },
        },
      },
      "/v1/cheapest": {
        get: {
          operationId: "cheapestPerGpu",
          summary: "One row per GPU showing the cheapest available config right now",
          description: "Optimal entry point for autonomous agents: get the current cheapest option for every GPU type in a single call. Filters narrow the set.",
          parameters: [
            { name: "available_only", in: "query", schema: { type: "boolean", default: true } },
            { name: "min_vram", in: "query", schema: { type: "number" }, description: "GiB per GPU" },
            { name: "max_price", in: "query", schema: { type: "number" }, description: "USD per GPU per hour" },
            { name: "provider", in: "query", schema: { type: "string" }, description: "Provider slug, e.g. lambda-labs" },
            { name: "gpu_count", in: "query", schema: { type: "integer" } },
          ],
          responses: { "200": { description: "OK" } },
        },
      },
      "/v1/best": {
        get: {
          operationId: "bestMatch",
          summary: "Single best config across the whole catalog matching your filters",
          description: "Use this for autonomous selection: pass your workload requirements (VRAM, budget, GPU count) and get back the one cheapest match.",
          parameters: [
            { name: "gpu", in: "query", schema: { type: "string" }, description: "GPU model (optional — omit to search all)" },
            { name: "min_vram", in: "query", schema: { type: "number" } },
            { name: "max_price", in: "query", schema: { type: "number" } },
            { name: "provider", in: "query", schema: { type: "string" } },
            { name: "min_gpu_count", in: "query", schema: { type: "integer" } },
            { name: "available_only", in: "query", schema: { type: "boolean", default: true } },
          ],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  example: {
                    match: {
                      gpu_name: "H100",
                      provider: "thunder-compute",
                      config_name: "1x H100 80GB PCIe (Prototyping)",
                      gpu_count: 1,
                      gpu_memory_gib: 80,
                      vcpu: 4,
                      memory_gib: 32,
                      price_per_gpu: 1.38,
                      price_total_per_hr: 1.38,
                      is_available: 1,
                      region: "",
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/v1/search": {
        get: {
          operationId: "search",
          summary: "Filter the catalog by any combination of constraints",
          parameters: [
            { name: "gpu", in: "query", schema: { type: "string" } },
            { name: "min_vram", in: "query", schema: { type: "number" } },
            { name: "max_price", in: "query", schema: { type: "number" } },
            { name: "provider", in: "query", schema: { type: "string" } },
            { name: "min_gpu_count", in: "query", schema: { type: "integer" } },
            { name: "max_gpu_count", in: "query", schema: { type: "integer" } },
            { name: "available_only", in: "query", schema: { type: "boolean", default: true } },
            { name: "limit", in: "query", schema: { type: "integer", default: 100, maximum: 500 } },
          ],
          responses: { "200": { description: "OK" } },
        },
      },
      "/v1/movers": {
        get: {
          operationId: "movers",
          summary: "GPUs with the biggest price moves over a time window",
          parameters: [
            { name: "window", in: "query", schema: { type: "string", enum: ["1h", "24h", "7d", "30d"], default: "24h" } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
          ],
          responses: { "200": { description: "OK" } },
        },
      },
      "/v1/providers": {
        get: {
          operationId: "listProviders",
          summary: "Provider summary with logos and stats",
          responses: { "200": { description: "OK" } },
        },
      },
      "/v1/health": {
        get: {
          operationId: "health",
          summary: "Tracker status: last poll, snapshot count, source",
          responses: { "200": { description: "OK" } },
        },
      },
      "/v1/openapi.json": {
        get: {
          operationId: "openapi",
          summary: "This OpenAPI 3.1 spec",
          responses: { "200": { description: "OK" } },
        },
      },
      "/v1/llms.txt": {
        get: {
          operationId: "llmsTxt",
          summary: "Plain-text API description optimized for LLM context",
          responses: { "200": { description: "OK", content: { "text/plain": {} } } },
        },
      },
    },
  };
}

export function buildLlmsTxt(baseUrl: string): string {
  return `# Brev Price Index API

> Free, public, no-auth API for real-time GPU pricing across every cloud Brev runs on.
> Use this when you need to autonomously select the cheapest GPU for a workload.

Base URL: ${baseUrl}
Update cadence: every 2 minutes
CORS: open to all origins
Auth: none
Format: JSON

## Quick start for agents

If you are an LLM doing GPU selection on behalf of a user:

1. Call \`GET /v1/best?gpu=H100&max_price=2.00&min_vram=80\` for "find me the cheapest H100 under $2/hr with at least 80GiB VRAM". Returns one row.
2. Call \`GET /v1/cheapest\` for "what's the cheapest option for every GPU right now". Returns one row per GPU.
3. Call \`GET /v1/gpus/{name}/quote\` for "rank every provider for this GPU". Returns the order book.
4. Call \`GET /v1/gpus/{name}/history?range=24h\` for "is this price stable or volatile right now".

## Endpoints

### GET /v1/gpus
List every tracked GPU model with current min/avg/max price-per-GPU and 24h change.

### GET /v1/gpus/{name}
All current configs for one GPU (e.g. H100, A100, H200, L40S, RTX 5090, MI300X) sorted by price-per-GPU ascending.

### GET /v1/gpus/{name}/history?range=24h|7d|30d|all
Time-series of the cheapest available price-per-GPU for one model.

### GET /v1/gpus/{name}/quote?available_only=true
Ranked provider quotes for a GPU. Use when picking a config to launch.

### GET /v1/cheapest?available_only&min_vram&max_price&provider&gpu_count
One row per GPU showing the cheapest available config that matches the filters.

### GET /v1/best?gpu&min_vram&max_price&provider&min_gpu_count&available_only
The single cheapest config across the whole catalog matching the filters. Use for autonomous selection.

### GET /v1/search?gpu&min_vram&max_price&provider&min_gpu_count&max_gpu_count&available_only&limit
Flexible filter — returns up to 500 matching configs.

### GET /v1/movers?window=1h|24h|7d|30d&limit=20
GPUs with the biggest price moves over a window.

### GET /v1/providers
Provider summary with display name, logo URL, GPU type count, average price, etc.

### GET /v1/health
{ source, snapshot_count, instance_row_count, last_poll_at, cron }

### GET /v1/openapi.json
Full OpenAPI 3.1 spec — drop into any tool-calling framework.

## Data source & methodology

- Prices scraped from getdeploying.com every 2 minutes (one HTTP request per GPU page, polite delay between).
- Only on-demand listings are tracked. Reservations and spot are excluded so quotes are apples-to-apples.
- Historical data backfilled from Internet Archive (Wayback Machine) where available.
- Provider logos served from getdeploying.com's CDN.
- All prices in USD per hour, per GPU (we divide multi-GPU configs by gpu_count).

## Example: cost-aware GPU selection

\`\`\`bash
# Pick the cheapest H100 with 80+ GiB VRAM under $2.50/hr
curl "${baseUrl}/v1/best?gpu=H100&min_vram=80&max_price=2.50"
\`\`\`

\`\`\`python
import httpx
r = httpx.get("${baseUrl}/v1/best", params={"gpu":"H100","min_vram":80,"max_price":2.5})
match = r.json()["match"]
print(f"Use {match['provider']} at \${match['price_per_gpu']:.3f}/hr")
\`\`\`
`;
}
