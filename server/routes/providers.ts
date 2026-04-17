import type { FastifyInstance } from "fastify";
import { listProviders, providersForGpu } from "../aggregations.js";
import { listProviderInfo } from "../db.js";

export default async function providerRoutes(app: FastifyInstance) {
  app.get("/api/providers", async () => {
    return { providers: listProviders() };
  });

  app.get<{ Querystring: { gpu?: string } }>("/api/providers/by-gpu", async (req) => {
    const gpu = req.query.gpu;
    if (!gpu) return { gpu_name: null, providers: [] };
    return { gpu_name: gpu, providers: providersForGpu(gpu) };
  });

  // slug -> {label, logo_url} dictionary used by the frontend to render logos.
  app.get("/api/providers/lookup", async () => {
    const list = listProviderInfo();
    const dict: Record<string, { label: string; short_name: string | null; logo_url: string | null }> = {};
    for (const p of list) {
      dict[p.slug] = {
        label: p.label,
        short_name: p.short_name,
        logo_url: p.logo_url,
      };
    }
    return { providers: dict };
  });
}
