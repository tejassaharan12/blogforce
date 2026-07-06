import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ImageSuggestion {
  query: string;
  use: "Featured Image" | "In-Content" | "Social Share";
  tip: string;
}

export async function POST(req: NextRequest) {
  const { topic, keywords, brand, excerpt } = await req.json();

  if (!topic || !brand) {
    return NextResponse.json({ error: "topic and brand required" }, { status: 400 });
  }

  const brandNote: Record<string, string> = {
    healthok: "multivitamin supplement, urban Indian office workers, health & wellness, energy",
    nimulid: "topical pain relief gel/spray, muscle pain, joint pain, physical activity",
    gas_o_fast: "antacid digestive relief, Indian food, acidity, jeera/cumin, stomach comfort",
  };

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    system: `You are a visual content specialist for Indian health brands. You suggest stock photo search queries that find real, relevant images for pharma/health blogs.
Images must be:
- India-appropriate (Indian faces, Indian settings when relevant)
- Non-stigmatising — show wellness and recovery, not suffering
- Safe for pharma brands — no images of medicine/pills unless it's a supplement brand
Return ONLY valid JSON. No markdown, no explanation.`,
    messages: [
      {
        role: "user",
        content: `Blog topic: "${topic}"
Brand context: ${brandNote[brand] ?? brand}
Keywords: ${Array.isArray(keywords) ? keywords.join(", ") : keywords}
Content excerpt: "${excerpt ?? ""}"

Suggest exactly 3 stock photo search queries for this blog — one for each usage:
1. Featured Image (hero image at top of blog, must instantly convey the topic)
2. In-Content (illustrative image placed mid-article)
3. Social Share (eye-catching, works as a thumbnail on LinkedIn/Instagram)

Each query should be 3–6 words, specific enough to find good results on Unsplash, Pexels, or Shutterstock.

Return this exact JSON:
{
  "images": [
    { "query": "search terms here", "use": "Featured Image", "tip": "one sentence on what to look for" },
    { "query": "search terms here", "use": "In-Content", "tip": "one sentence on what to look for" },
    { "query": "search terms here", "use": "Social Share", "tip": "one sentence on what to look for" }
  ]
}`,
      },
    ],
  });

  const raw = (response.content[0] as { type: string; text: string }).text;
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ error: "Could not parse image suggestions" }, { status: 500 });
  }

  try {
    const data = JSON.parse(jsonMatch[0]) as { images: ImageSuggestion[] };
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Could not parse image suggestions" }, { status: 500 });
  }
}
