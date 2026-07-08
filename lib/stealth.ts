const STEALTH_API_URL = "https://stealthgpt.ai/api/stealthify";

export interface StealthResult {
  content: string;
  humanScore: number; // 0-100, higher = more human-like
  wordsSpent: number;
  cost_usd: number;
}

export async function humanizeContent(text: string): Promise<StealthResult> {
  const apiKey = process.env.STEALTHGPT_API_KEY;
  if (!apiKey) throw new Error("STEALTHGPT_API_KEY not configured");

  const res = await fetch(STEALTH_API_URL, {
    method: "POST",
    headers: {
      "api-token": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: text,
      rephrase: true,
      tone: "College",
      mode: "High",
      qualityMode: "quality",
      model: "heavy",
      outputFormat: "markdown",
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`StealthGPT ${res.status}: ${err}`);
  }

  const data = await res.json();
  const wordsSpent: number = typeof data.wordsSpent === "number" ? data.wordsSpent : 0;

  return {
    content: data.result ?? text,
    humanScore: typeof data.howLikelyToBeDetected === "number" ? data.howLikelyToBeDetected : 0,
    wordsSpent,
    cost_usd: (wordsSpent / 1000) * 0.2,
  };
}
