import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BRAND_CONTEXT: Record<string, string> = {
  healthok: `Brand: HealthOK Multivitamin Supplement (Pure Veg, 19 vitamins + minerals + Natural Ginseng + Taurine)
Target reader: Urban Indian professionals aged 25–45, busy corporate workers
Category: FSSAI-regulated nutraceutical supplement (cannot claim to cure/treat — can claim "may support")
Key themes to cover: energy & fatigue, nutrition gaps in Indian vegetarian diet, corporate wellness, vitamin B12/D3 deficiency, daily habits`,

  nimulid: `Brand: Nimulid Strong Topical Gel & Spray (2X Diclofenac, for external use only)
Target reader: Urban Indian adults with muscle/joint pain, active people, seniors, desk workers
Category: Topical OTC pain relief product (Drug & Cosmetics Act — no "cures" or "heals" claims)
Key themes to cover: neck pain, back pain, muscle stiffness, sports injuries, desk job posture, arthritis management, recovery`,

  gas_o_fast: `Brand: Gas-O-Fast Asli Jeera (OTC antacid with authentic cumin/jeera)
Target reader: Broad pan-Indian adults dealing with digestive issues
Category: OTC antacid/digestive relief (AYUSH guidelines — "jeera" is AYUSH-approved)
Key themes to cover: acidity, bloating, gas, indigestion after heavy meals, home remedies, Indian food triggers, digestive health tips`,
};

interface Suggestion {
  topic: string;
  keywords: string[];
  why: string;
}

export async function POST(req: NextRequest) {
  const { brand } = await req.json();

  if (!brand || !BRAND_CONTEXT[brand as string]) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1400,
    system: `You are a content strategist for Indian pharma and health brands. You generate blog topic ideas that are:
- Genuinely useful to the reader (not just promotional)
- Searchable — topics people actually Google in India
- Safe for pharma advertising — no "cures", "treats", "eliminates" language in topics or keywords
- Diverse — cover different angles (how-to, listicle, explainer, FAQ, lifestyle)
Return ONLY valid JSON. No markdown, no code fences, no explanation text.`,
    messages: [
      {
        role: "user",
        content: `${BRAND_CONTEXT[brand]}

Generate exactly 6 blog topic ideas. Make them varied: mix how-to guides, listicles, explainers, and lifestyle angles.

CRITICAL RULE FOR KEYWORDS: Each keyword must be SHORT — 2 or 3 words maximum. These must be terms real Indian users type into Google, not invented phrases. Think: "back pain relief", "neck pain gel", "vitamin B12 deficiency" — not "quick back pain solutions for office workers". Short keywords have actual search volume; long phrases have zero.

Return this exact JSON structure:
{
  "suggestions": [
    {
      "topic": "clear blog title that someone would Google",
      "keywords": ["2-3 word keyword", "2-3 word keyword", "2-3 word keyword", "2-3 word keyword", "2-3 word keyword"],
      "why": "one sentence: why this topic attracts readers and works for the brand"
    }
  ]
}`,
      },
    ],
  });

  const raw = (response.content[0] as { type: string; text: string }).text;

  // Extract JSON even if Haiku wraps it in text
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ error: "Could not parse suggestions" }, { status: 500 });
  }

  try {
    const data = JSON.parse(jsonMatch[0]) as { suggestions: Suggestion[] };
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Could not parse suggestions" }, { status: 500 });
  }
}
