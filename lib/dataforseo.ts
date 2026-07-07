const DFS_API_BASE = "https://api.dataforseo.com/v3";

export interface KeywordMetric {
  keyword: string;
  search_volume: number | null;
  competition_level: "LOW" | "MEDIUM" | "HIGH" | null;
  cpc: number | null;
}

export interface KeywordMetricsResult {
  metrics: KeywordMetric[];
  cost_usd: number;
}

function getAuthHeader(): string {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) throw new Error("DataForSEO credentials not configured");
  return "Basic " + Buffer.from(`${login}:${password}`).toString("base64");
}

export async function getKeywordMetrics(keywords: string[]): Promise<KeywordMetricsResult> {
  if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) {
    return { metrics: [], cost_usd: 0 };
  }
  if (keywords.length === 0) return { metrics: [], cost_usd: 0 };

  try {
    const res = await fetch(`${DFS_API_BASE}/keywords_data/google_ads/search_volume/live`, {
      method: "POST",
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          keywords: keywords.slice(0, 10), // cap at 10 to control cost
          location_code: 2356,             // India
          language_code: "en",
          search_partners: false,
        },
      ]),
    });

    const data = await res.json();
    const task = data?.tasks?.[0];
    const results: Record<string, unknown>[] = task?.result ?? [];
    const cost_usd: number = typeof task?.cost === "number" ? task.cost : 0;

    return {
      metrics: results.map((r) => ({
        keyword: r.keyword as string,
        search_volume: r.search_volume != null ? (r.search_volume as number) : null,
        competition_level: (r.competition_level as "LOW" | "MEDIUM" | "HIGH") ?? null,
        cpc: r.cpc != null ? parseFloat((r.cpc as number).toFixed(2)) : null,
      })),
      cost_usd,
    };
  } catch {
    return { metrics: [], cost_usd: 0 };
  }
}
