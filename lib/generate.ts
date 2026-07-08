import Anthropic from "@anthropic-ai/sdk";
import {
  checkCompliance,
  getRequiredWarnings,
  getAutoDisclaimer,
  getRegulatory,
  type BrandKey,
} from "./compliance";
import { checkPlagiarism, type PlagiarismResult } from "./plagiarism";
import { getKeywordMetrics, type KeywordMetric } from "./dataforseo";
import { humanizeContent } from "./stealth";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Claude Opus 4.8 pricing in INR (at ₹85/USD)
// Input: $15/MTok = ₹1,275/MTok  Output: $75/MTok = ₹6,375/MTok
const MODEL = "claude-opus-4-8";
const INPUT_COST_PER_MTok = 1275;
const OUTPUT_COST_PER_MTok = 6375;

// Monthly budget cap in INR — generation stops and warns if exceeded
const MONTHLY_BUDGET_CAP_INR = 3000;

export type TargetLength = "500" | "800" | "1200" | "2000";

export interface GenerateRequest {
  brand: BrandKey;
  topic: string;
  keywords: string[];
  target_audience: string;
  content_type: string;
  brand_voice_hint?: string;
  target_length?: TargetLength;
  // Pre-researched SEO fields (from imported content plan)
  primary_keyword?: string;
  secondary_keywords?: string;
  lsi_keywords?: string;
  content_angle?: string;
  cta_link?: string;
}

export interface GenerateResult {
  content: string;
  pass1_content: string;
  compliance: ReturnType<typeof checkCompliance>;
  plagiarism: PlagiarismResult;
  seo: {
    keywords_found: string[];
    keywords_missing: string[];
    word_count: number;
    readability: string;
    meta_title: string;
    meta_description: string;
    url_slug: string;
    suggested_schema: string;
  };
  aeo: {
    has_faq_structure: boolean;
    has_numbered_lists: boolean;
    has_headings: boolean;
    citation_signals: string[];
  };
  geo: {
    india_context: boolean;
    location_signals: string[];
    ai_overview_ready: boolean;
  };
  tokens: {
    pass1_input: number;
    pass1_output: number;
    pass2_input: number;
    pass2_output: number;
    total: number;
  };
  cost_inr: number;
  cost_breakdown: {
    pass1_cost: number;
    pass2_cost: number;
    stealth_cost: number;
    dataforseo_cost: number;
    copyscape_cost: number;
    total_cost: number;
  };
  human_score: number;
  keyword_data: KeywordMetric[];
  model: string;
}

// ── BRAND VOICE GUIDES (learned from approved blog samples) ─────────────────
// These encode the actual tone, structure, language patterns, and compliance
// phrasing observed in client-approved content for each brand.
const BRAND_VOICE_GUIDES: Partial<Record<BrandKey, string>> = {
  healthok: `
=== HEALTHOK BRAND VOICE GUIDE (from approved blog samples) ===

PRODUCT FACTS (use where relevant — never fabricate additional claims):
- Full name: Pure Veg HealthOK Multivitamin Tablets (short: "HealthOK")
- Unique formula: 19 essential vitamins & minerals + Natural Ginseng + Taurine
- Core USP: Pure Veg (gelatin-free tablet, not a softgel capsule)
- Clinical claim — use EXACTLY this phrasing: "shown in clinical studies to improve energy and fatigue scores within 14 days in some individuals"
- For Men & Women
- How to position: "hassle-free, pure veg daily habit that fits seamlessly into your wellness journey"

TONE — who you're talking to and how:
- Urban Indian professionals, typically late 20s to mid-40s
- Conversational, warm, slightly witty — like a smart friend who happens to know their nutrition
- Empathetic and validating, never preachy or lecture-y
- Self-aware humor that gently mocks wellness culture, corporate chaos, and Indian daily life
- Strong empathy lines work well: "You're not lazy. Your system is simply carrying more load than before."
- Never condescending. The reader is smart — just busy.

STRUCTURAL PATTERNS — replicate these:
1. Open with a very relatable, specific scene (not a generic statement). Hook in the first 2 sentences.
2. Include short "punchline" paragraphs for rhythm: "Plot twist.", "Simple.", "The problem?", "They aren't." — these are single-sentence paragraphs used for impact.
3. Section headings use either: (a) creative character names "The Ghost Nutrient: Vitamin B12" or (b) conversational questions "So… How Do You Fix This?" or (c) direct declarations "The Urban Lifestyle Is Quietly Draining You"
4. Bullet points with BOLD lead phrase: "**Stop Treating Sleep Like Optional DLC:** Sleep is not a reward — it's the biological reason productivity exists."
5. Product introduction comes naturally ~2/3 through, never at the start. Lead with: "This is exactly where [product] changes the game" or "This is where a trusted daily companion like HealthOK steps in."
6. End with an 8-10 question FAQ in plain, conversational Q&A format.
7. Keep paragraphs to 2-3 sentences max. Mix short (1-sentence) and medium (2-3 sentence) paragraphs.

LANGUAGE PATTERNS — weave these in naturally:
- Hindi phrases (no translation needed, used for rhythm and cultural resonance): "Itna toh hota hai", "Corporate life hai boss", "Weekend pe recover kar lunga", "kal se healthy khaunga", "ghar ka khana"
- Indian food references: dal-chawal, sabzi-roti, palak paneer, rajma-chawal, khichdi, chai, dahi, paneer, filter coffee, roti, the kitchen dabba
- Urban Indian life: traffic jams, client calls, Slack notifications, inbox overload, back-to-back meetings, long commutes, fluorescent office lights
- Vivid modern analogies: "your body switched from a high-performance machine to a government office printer", "functioning like a premium smartphone stuck on 12% battery", "unlocked afternoon zombie mode", optional (DLC reference for gaming context), "inbox has multiplied like mosquitoes in monsoon season"
- Cultural health myths to gently challenge: "But I eat palak paneer every week!" / "ghar ka khana" assumption

APPROVED COMPLIANCE PHRASING (use these, do not invent new medical claims):
✅ USE: "may help support", "may contribute to", "helps support", "can help", "it may help"
✅ USE: "shown in clinical studies to improve energy and fatigue scores within 14 days in some individuals"
✅ USE: "designed specifically to help support daily nutritional needs"
✅ USE: "contributes to normal energy metabolism"
✅ USE: "helps maintain everyday functioning"
✅ USE: "supports active energy and overall wellness"
❌ NEVER: "treats", "cures", "prevents disease", "eliminates", "guarantees", "100% effective", "proven to cure"
❌ NEVER: "boost your immunity" (too absolute) → use "support your immune system"

FORBIDDEN WORDS/PHRASES (remove if present in draft):
- "In conclusion", "Furthermore", "Moreover", "It is worth noting", "Additionally", "It should be noted"
- "Embark on a wellness journey", "unlock your potential", "transform your health"
- Any passive voice constructions where active voice is possible
- Overly clinical jargon without plain-English follow-up
=== END HEALTHOK GUIDE ===`,

  nimulid: `
=== NIMULID STRONG BRAND VOICE GUIDE (from approved website content) ===

PRODUCT FACTS (critical — never fabricate):
- Products: Nimulid Strong Gel and Nimulid Strong Spray
- Active ingredient: 2X Diclofenac formula
- Category: Topical pain relief product — FOR EXTERNAL USE ONLY
- Manufacturer: Mankind Pharma
- Primary indication: Neck pain, muscle stiffness, muscle tension
- Target users: Urban Indian professionals, all adult age groups including seniors; topical gel also used for children (with doctor's advice)
- Brand positioning: "Partner in your journey to reclaim comfort" / "Companion through the city"

TONE:
- Aspirational, motivational, empathetic — more elevated than casual/witty
- Validates the reader's pain as real, then positions relief as achievable
- Not comedic or snarky — warmer and more sincere than HealthOK's style
- Lifestyle-integrated: pain relief enables you to live fully, not just survive
- Urban professional focus but age-inclusive in approach

STRUCTURAL PATTERNS (from approved blogs):
1. Open with a scene from urban Indian daily life — metro commute, desk marathon, city hustle
2. Acknowledge the pain/problem with empathy ("neck pain can significantly affect your daily life")
3. Use a Problem → Urban Context → Solution → Benefit arc in each section
4. Section headings are direct and informational: "The Reason for Neck Pain", "Combating Neck Pain in Urban Life", "Elevating Everyday Experiences"
5. Product introduced as "companion" or "partner" — never as a hard sell
6. Closing is motivational and forward-looking: "Navigate your city's challenges confidently, knowing you have the support to live well and pain-free."
7. Age-segmented content works well when topic allows (children/teens → working adults → seniors)
8. End with FAQ section (6-10 questions)

LANGUAGE PATTERNS:
- Urban India metaphors and scenes: metro stops, desk marathons, long commutes, remote work setups, city hustle
- Elevated metaphors for pain: "silent adversary", "symphony of stress", "tapestry of daily challenges", "weight of discomfort"
- Benefit language: "reclaim your day", "pain-free living", "freedom of movement", "move through the city", "live well", "navigate challenges confidently"
- Product as enabler of life: "so you can reclaim your day", "partner in your journey", "support you need to live well"
- Yoga/wellness integration is natural for this brand (blog used yoga poses + product)
- Do NOT use Hindi phrases or food references — this brand has a more pan-Indian, professional register

APPROVED COMPLIANCE PHRASING:
✅ USE: "may help provide relief from", "helps manage", "can offer relief from", "designed to help relieve"
✅ USE: "quick relief" (acceptable for topical OTC — seen in approved blogs)
✅ USE: "enhance the healing process" (used in approved content)
✅ USE: "helps manage pain and discomfort"
✅ USE: "use as directed"
❌ NEVER: "cures", "permanently eliminates", "guaranteed relief", "no side effects", "heals injury", "100% effective"
❌ NEVER: imply application near eyes or on broken skin

MANDATORY IN EVERY BLOG (weave naturally, not as a list):
- "For external use only" — must appear at least once
- "Consult a doctor if pain persists" — must appear at least once
=== END NIMULID GUIDE ===`,

  gas_o_fast: `
=== GAS-O-FAST BRAND VOICE GUIDE (from approved website content) ===

PRODUCT FACTS (use accurately — never fabricate):
- Product name: Gas-O-Fast Asli Jeera (always use this full name when mentioning the product)
- Category: OTC antacid / digestive relief
- Key ingredient: Asli Jeera (authentic/real cumin) — the "natural" in the OTC space
- Positioning: Natural OTC digestive relief; the smarter, gentler choice for stomach discomfort
- Regulatory: AIOCD OTC Code | AYUSH Guidelines (cumin is AYUSH-approved)

TONE:
- Wellness educator first, product promoter last — the brand builds genuine trust before selling
- Educational, practical, warm, and reassuring — not funny, not aspirational
- Conversational but credible: balances everyday language with accurate health information
- Empathetic validation: acknowledges the reader's discomfort as real and common
- Inclusive and broad — not targeted to any specific age group or city type
- Natural/holistic philosophy without being anti-medicine

STRUCTURAL PATTERNS (from approved blogs):
1. Open with a relatable problem statement: "Stomachaches are a common ailment that we've all experienced" / "Digestive discomfort can be a source of annoyance and embarrassment"
2. Explain the mechanism briefly (the WHY behind the problem) — builds credibility
3. Use numbered lists heavily — "Top 10", "6 causes", "8 remedies" format is standard
4. Bold subheadings for each list item + 2-3 sentence explanation per item
5. Provide home/natural remedies genuinely and thoroughly — DO NOT dismiss them
6. Product mentioned once, naturally, near the end as: "For fast relief, you can also try Gas-O-Fast Asli Jeera" — never a hard sell
7. Closing acknowledges individual variation: "everyone's digestive system is unique, so listen to your body"
8. Always ends with medical disclaimer
9. No FAQ section needed — the list-heavy educational format covers all questions inline

LANGUAGE PATTERNS:
- Direct, clear, no jargon: "the lower esophageal sphincter" gets explained simply right after
- Action phrases: "you can chew", "mix", "drink", "try", "apply"
- Reassuring pivots: "you don't always need to reach for over-the-counter medications"
- Natural positioning: "natural and holistic approach", "simple and natural home remedies"
- Gentle caution phrases: "be cautious with the quantity", "use with caution", "listen to your body"
- Closing warmth: "get back to feeling your best", "enjoy your meals without the fiery aftermath"
- NO Hindi phrases — this brand uses clean pan-Indian English throughout
- NO urban Indian humor or cultural jokes — more inclusive, generic wellness register
- Reference foods inclusively: Greek yogurt, oatmeal, almonds, avocado are acceptable alongside Indian options

APPROVED COMPLIANCE PHRASING:
✅ USE: "can help provide quick relief", "helps in digestion", "may help with", "can provide relief from"
✅ USE: "for temporary symptomatic relief"
✅ USE: "consult a doctor if symptoms persist" (required in every blog)
✅ USE: "natural approach to managing" (not "curing")
✅ USE: "can contribute to digestive discomfort"
❌ NEVER: "permanently cures acidity", "eliminates gas forever", "prevents all digestive issues"
❌ NEVER: "100% natural" (unless certified — use just "natural" or "naturally sourced")
❌ NEVER: "no side effects", "completely safe for everyone", "replaces medication"
❌ NEVER: Position as a replacement for medical treatment — always "complement your lifestyle"

MANDATORY IN EVERY BLOG:
- "Consult a doctor if symptoms persist" — must appear at least once in body text
- Medical disclaimer at the bottom: "This blog is not a substitute for professional medical advice. Please consult a healthcare professional for any medical concerns."
- Product mention (if included): use exact name "Gas-O-Fast Asli Jeera" — not just "Gas-O-Fast"
=== END GAS-O-FAST GUIDE ===`,
};

const AUDIENCE_TONE: Record<string, string> = {
  patients:
    "Write in warm, empathetic language. Speak directly to someone living with the condition. Avoid clinical jargon. Make them feel understood, not lectured.",
  doctors:
    "Use precise clinical language. Reference evidence-based practice. Be concise and information-dense. Doctors respect directness.",
  general:
    "Write accessibly for a broad Indian adult audience. Balance warmth with useful information. Assume they're smart but not medically trained.",
  pharmacy_staff:
    "Be practical and product-focused. Include dispensing tips, common patient questions, and counselling points pharmacy staff can actually use.",
};

const CONTENT_TYPE_FORMAT: Record<string, string> = {
  blog: "A narrative blog post. Engaging hook opening, 3–4 body sections with descriptive subheadings, and a conclusion with a clear call to action.",
  guide:
    "A comprehensive how-to guide. Open with why this matters, use numbered steps, include tips boxes, and end with a quick-reference summary.",
  faq: "A FAQ article. Use at least 8 real questions someone would actually Google. Bold each question. Give thorough, honest answers.",
  product_info:
    "A product information page. Sections: What it is → How it works → Who it is for → How to use → Precautions → FAQs.",
};

function calcCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * INPUT_COST_PER_MTok +
    (outputTokens / 1_000_000) * OUTPUT_COST_PER_MTok
  );
}

export async function generateBlog(
  req: GenerateRequest,
  currentMonthlySpend: number = 0
): Promise<GenerateResult> {
  // Budget guard — stop before generating if already over cap
  if (currentMonthlySpend >= MONTHLY_BUDGET_CAP_INR) {
    throw new Error(
      `Monthly budget cap of ₹${MONTHLY_BUDGET_CAP_INR} reached. Current spend: ₹${currentMonthlySpend.toFixed(2)}. Please contact your administrator to increase the limit.`
    );
  }

  const warnings = getRequiredWarnings(req.brand);
  const disclaimer = getAutoDisclaimer(req.brand);
  const regulatory = getRegulatory(req.brand);
  const keywordsStr = req.keywords.join(", ");
  const audienceTone = AUDIENCE_TONE[req.target_audience] ?? AUDIENCE_TONE.general;
  const formatGuide = CONTENT_TYPE_FORMAT[req.content_type] ?? CONTENT_TYPE_FORMAT.blog;

  // ── PASS 1: GENERATION ──────────────────────────────────────────────────────
  // Focus: factual accuracy, SEO structure, compliance, keyword placement

  const pass1System = `You are a senior pharmaceutical content strategist writing for the Indian healthcare market.
Your job is to produce accurate, well-structured, SEO-optimised content that strictly follows Indian drug advertising regulations.

REGULATORY FRAMEWORK: ${regulatory}

COMPLIANCE RULES — NON-NEGOTIABLE:
- Never use: "cure", "cures", "heals", "guaranteed", "100% effective", "no side effects", "safe for everyone", "best", "miracle"
- Always use measured language: "may help", "can provide relief from", "consult your doctor before use"
- Never make claims that cannot be substantiated
- Always recommend professional medical consultation

REQUIRED SAFETY STATEMENTS — weave these naturally into the content:
${warnings.map((w, i) => `${i + 1}. ${w}`).join("\n")}

FORMAT: ${formatGuide}

E-E-A-T SIGNALS (required for Google health content ranking):
- EXPERTISE: Explain the mechanism or science behind each recommendation — not just "what" but "why it works"
- EXPERIENCE: Use practical, grounded examples a real person with this condition would recognise
- AUTHORITATIVENESS: Reference credible Indian health bodies where relevant — ICMR, NIN (National Institute of Nutrition), FSSAI, AYUSH Ministry, WHO. Do NOT fabricate specific study names or statistics — use references like "According to ICMR dietary guidelines..." or "Research suggests..."
- TRUSTWORTHINESS: Include the required medical disclaimer, use measured language throughout, never overclaim

AEO — ANSWER ENGINE OPTIMIZATION (featured snippets & Google AI Overviews):
- DIRECT ANSWER PARAGRAPH: Within the first 150 words, write one clean 40–60 word paragraph that directly answers the main query. Start it with the primary keyword. This is what Google and AI engines pull for featured snippets.
- FAQ FORMAT: Every FAQ question must follow this exact format so Google can extract it:
  **Q: [Full question ending with ?]**
  [Direct 2–3 sentence answer with no preamble]
- Cite sources using: "According to [ICMR / WHO / NIN / FSSAI / AYUSH Ministry], ..." — at least 2 times in the article

GEO — GENERATIVE ENGINE OPTIMIZATION (AI search: Perplexity, ChatGPT, Google SGE):
- Write at least 3 CITABLE FACTUAL STATEMENTS — clear declarative sentences that an AI model can extract and attribute. Format: "[Subject] [factual verb] [specific fact]." Example: "Cumin seeds contain compounds that relax intestinal muscles and reduce gas pressure."
- DEFINE KEY ENTITIES clearly the first time you mention them: what the condition is, what the ingredient does, how the product works — in one direct sentence. AI engines use these definitions.
- Open each main section with a factual, citable statement — not a question, not a vague opener.

SEO REQUIREMENTS:
- Include these keywords naturally (no stuffing): ${keywordsStr}
- Use ## for main headings, ### for subheadings
- STRICT word count: ${
      req.target_length === "500" ? "350–390 words MAXIMUM. Stop at 390 words. No FAQ section." :
      req.target_length === "800" ? "580–630 words. Include a short FAQ with 2–3 questions only." :
      req.target_length === "1200" ? "880–980 words. Include a FAQ section with 4–5 questions." :
      req.target_length === "2000" ? "1,500–1,600 words. Include a comprehensive FAQ section with 6–8 questions." :
      "720–800 words. Include a FAQ section with 3–4 questions."
    } (StealthGPT will expand this ~30% to reach the final target)
- Write meta title (under 60 chars) and meta description (under 155 chars) at the very top in this format:
  META_TITLE: your title here
  META_DESC: your description here
  (then start the article)

TARGET AUDIENCE: ${req.target_audience}
AUDIENCE TONE: ${audienceTone}

${req.brand_voice_hint ? `BRAND VOICE — match this style closely:\n"${req.brand_voice_hint}"` : ""}

End the article with this disclaimer on its own line after a divider:
---
${disclaimer}`;

  const planKeywordSection = req.primary_keyword
    ? `\nKEYWORD TARGETING (pre-researched — follow precisely):
• PRIMARY KEYWORD: "${req.primary_keyword}" — must appear in the H1, opening paragraph, and meta title
${req.secondary_keywords ? `• SECONDARY KEYWORDS: ${req.secondary_keywords} — use naturally in subheadings and body` : ""}
${req.lsi_keywords ? `• LSI / SEMANTIC KEYWORDS: ${req.lsi_keywords} — weave throughout for topical depth` : ""}
${req.content_angle ? `• CONTENT ANGLE: ${req.content_angle.split("(")[0].trim()} — follow this angle precisely` : ""}
${req.cta_link ? `• CTA: Include one natural hyperlink to [this product page](${req.cta_link}) near the end` : ""}`
    : "";

  const pass1User = `Write a ${req.content_type} about: "${req.topic}"
Brand: ${req.brand.replace(/_/g, "-").toUpperCase()}
Keywords to include: ${keywordsStr}
${planKeywordSection}

Prioritise accuracy, natural keyword placement, proper structure, and full compliance.`;

  const maxOutputTokens =
    req.target_length === "2000" ? 5000 :
    req.target_length === "1200" ? 3000 :
    req.target_length === "800" ? 1800 :
    req.target_length === "500" ? 1000 :
    2000;

  const pass1Response = await client.messages.create({
    model: MODEL,
    max_tokens: maxOutputTokens,
    system: pass1System,
    messages: [{ role: "user", content: pass1User }],
  });

  const pass1Content = (pass1Response.content[0] as { type: string; text: string }).text;
  const p1InputTokens = pass1Response.usage.input_tokens;
  const p1OutputTokens = pass1Response.usage.output_tokens;
  const pass1Cost = calcCost(p1InputTokens, p1OutputTokens);

  // Check if pass 2 + APIs would exceed budget
  // DataForSEO: ~$0.045/keyword × up to 10 = ~$0.45 = ~₹38 worst case
  // Copyscape: $0.03 base (200 words) + $0.01/100 words after = $0.11 for 1000-word cap = ₹9.35
  const estimatedPass2Cost = calcCost(2500, 1800);
  const estimatedApiCost = (req.keywords.length * 0.045 * 85) + 9.35;
  const estimatedTotal = pass1Cost + estimatedPass2Cost + estimatedApiCost;
  if (currentMonthlySpend + estimatedTotal > MONTHLY_BUDGET_CAP_INR) {
    throw new Error(
      `Generating this blog would exceed your monthly budget cap of ₹${MONTHLY_BUDGET_CAP_INR}. Current spend: ₹${currentMonthlySpend.toFixed(2)}. This generation would cost approx ₹${estimatedTotal.toFixed(2)} (AI + DataForSEO + Copyscape).`
    );
  }

  // ── PASS 2: HUMANISATION ────────────────────────────────────────────────────
  // Focus: natural language, brand voice, emotional resonance, readability

  const brandVoiceGuide = BRAND_VOICE_GUIDES[req.brand] ?? "";
  const userVoiceHint = req.brand_voice_hint
    ? `\nADDITIONAL DIRECTION FROM EDITOR:\n"${req.brand_voice_hint}"`
    : "";

  const pass2System = `You are a senior content editor and brand voice specialist for Indian healthcare brands.
You receive a well-structured but slightly formal draft and transform it into content that feels genuinely human — warm, natural, and engaging.

UNIVERSAL RULES (apply to all brands):
1. Keep ALL facts, safety warnings, keywords, headings, FAQ structure, and disclaimer exactly as they are — never change medical content
2. Rewrite sentences to flow naturally — vary sentence length, use contractions, avoid passive voice
3. Speak directly to the reader using "you" and "your" throughout
4. Remove all robotic/AI filler: "it is important to note", "it is worth mentioning", "in conclusion", "furthermore", "moreover", "additionally", "it should be noted"
5. Keep paragraphs short — 2–3 sentences max; mix in single-sentence paragraphs for rhythm and impact
6. Do NOT change the META_TITLE, META_DESC, or the disclaimer at the bottom
7. Do NOT add new medical claims or change any compliance language
8. The final output must pass a "did a real human who knows this brand write this?" test

${brandVoiceGuide || "Default tone: warm, honest, direct, knowledgeable but approachable. Like advice from a trusted friend who happens to be a doctor."}${userVoiceHint}`;

  const pass2TargetWords =
    req.target_length === "500" ? "350–390" :
    req.target_length === "800" ? "580–630" :
    req.target_length === "1200" ? "880–980" :
    req.target_length === "2000" ? "1,500–1,600" :
    "720–800";

  const pass2MaxTokens =
    req.target_length === "500" ? 1000 :
    req.target_length === "800" ? 1800 :
    req.target_length === "1200" ? 3000 :
    req.target_length === "2000" ? 5000 :
    2000;

  const pass2User = `Humanise this healthcare article. STRICT word count: ${pass2TargetWords} words — do NOT expand the content, only rephrase it. Keep all facts, structure, keywords, warnings, and disclaimer intact:

${pass1Content}`;

  const pass2Response = await client.messages.create({
    model: MODEL,
    max_tokens: pass2MaxTokens,
    system: pass2System,
    messages: [{ role: "user", content: pass2User }],
  });

  const pass2RawContent = (pass2Response.content[0] as { type: string; text: string }).text;
  const p2InputTokens = pass2Response.usage.input_tokens;
  const p2OutputTokens = pass2Response.usage.output_tokens;
  const pass2Cost = calcCost(p2InputTokens, p2OutputTokens);

  // ── STEALTHGPT: AI-DETECTION BYPASS ─────────────────────────────────────────
  // Strip META lines before sending — StealthGPT must not rewrite them
  const metaTitleMatch = pass2RawContent.match(/META_TITLE:\s*(.+)/);
  const metaDescMatch = pass2RawContent.match(/META_DESC:\s*(.+)/);
  const bodyForStealth = pass2RawContent
    .replace(/^META_TITLE:.*$/m, "")
    .replace(/^META_DESC:.*$/m, "")
    .replace(/^\n+/, "")
    .trim();

  const stealthResult = await humanizeContent(bodyForStealth, req.target_length);
  const stealthCostInr = stealthResult.cost_usd * 85;

  // Strip meta lines from visible content — stored in seo.meta_title/meta_description
  const strippedContent = stealthResult.content
    .replace(/^\n+/, "")
    .trim();

  // ── AI-PATTERN SAFETY NET ────────────────────────────────────────────────────
  // Programmatically remove patterns that AI reliably reintroduces despite prompt instructions.
  // This runs after Pass 3 so it catches whatever slips through.
  const finalContent = strippedContent
    // Em dashes — #1 AI tell, must be removed without exception
    .replace(/ — /g, ", ")
    .replace(/—/g, ", ")
    // Sentence-starting AI transition words
    .replace(/^Furthermore,\s*/gim, "And ")
    .replace(/^Moreover,\s*/gim, "And ")
    .replace(/^Additionally,\s*/gim, "Also, ")
    .replace(/^In conclusion,\s*/gim, "So: ")
    .replace(/^To summarize,\s*/gim, "")
    .replace(/^In summary,\s*/gim, "")
    // Filler phrases that add no information
    .replace(/[Ii]t'?s worth noting that\s*/g, "")
    .replace(/[Ii]t is worth noting that\s*/g, "")
    .replace(/[Ii]t is important to note that\s*/g, "")
    .replace(/[Ii]t's important to note that\s*/g, "")
    .replace(/[Ii]n today'?s fast-paced world[,.]?\s*/g, "")
    .replace(/[Aa]t the end of the day[,.]?\s*/g, "")
    // Classic AI verb replacements
    .replace(/\bdelve into\b/gi, "look at")
    .replace(/\bdelves into\b/gi, "looks at")
    .replace(/\bdelving into\b/gi, "looking at")
    .replace(/\bdelved into\b/gi, "looked at")
    .replace(/\bunpack\b/gi, "break down")
    .replace(/\bunpacks\b/gi, "breaks down")
    .replace(/\bunpacking\b/gi, "breaking down")
    .replace(/\bunpacked\b/gi, "broke down")
    .replace(/\bsupercharge\b/gi, "boost")
    .replace(/\bsupercharges\b/gi, "boosts")
    .replace(/\butilize\b/gi, "use")
    .replace(/\butilizes\b/gi, "uses")
    .replace(/\butilising\b/gi, "using")
    .replace(/\butilising\b/gi, "using")
    .replace(/\butilise\b/gi, "use")
    // Unsung heroes
    .replace(/unsung heroes? of\b/gi, "key part of")
    .replace(/\bunsung heroes?\b/gi, "overlooked factors")
    // Game-changer
    .replace(/\bgame-changer\b/gi, "major shift")
    .replace(/\bgame changer\b/gi, "major shift")
    // Clean up any double spaces or leading commas from replacements
    .replace(/, ,/g, ",")
    .replace(/,\s*\./g, ".")
    .replace(/  +/g, " ")
    .trim();

  const totalTokens = p1InputTokens + p1OutputTokens + p2InputTokens + p2OutputTokens;

  // ── COMPLIANCE CHECK ────────────────────────────────────────────────────────
  const compliance = checkCompliance(finalContent, req.brand);

  // ── PLAGIARISM CHECK ────────────────────────────────────────────────────────
  const plagiarism = await checkPlagiarism(finalContent);

  // ── DATAFORSEO KEYWORD METRICS ───────────────────────────────────────────────
  const { metrics: keywordData, cost_usd: dfsUsd } = await getKeywordMetrics(req.keywords);
  const dataforseoCostInr = dfsUsd * 85;
  const copyscapeCostInr = plagiarism.cost_usd * 85;
  const totalCost = pass1Cost + pass2Cost + stealthCostInr + dataforseoCostInr + copyscapeCostInr;

  // ── SEO ANALYSIS ────────────────────────────────────────────────────────────
  const words = finalContent.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const contentLower = finalContent.toLowerCase();

  const keywordsFound = req.keywords.filter((k) =>
    contentLower.includes(k.toLowerCase())
  );
  const keywordsMissing = req.keywords.filter(
    (k) => !contentLower.includes(k.toLowerCase())
  );

  // META lines already extracted from pass2RawContent above
  const metaTitle = metaTitleMatch?.[1]?.trim() ?? req.topic.substring(0, 60);
  const metaDescription =
    metaDescMatch?.[1]?.trim() ??
    finalContent.replace(/#+\s/g, "").substring(0, 155) + "...";

  const sentences = finalContent.split(/[.!?]+/).filter((s) => s.trim().length > 10);
  const avgWordsPerSentence = wordCount / (sentences.length || 1);
  const readability =
    avgWordsPerSentence < 15 ? "Easy" : avgWordsPerSentence < 20 ? "Medium" : "Complex";

  // ── FAQ EXTRACTION FOR FAQPage SCHEMA ──────────────────────────────────────
  // Looks for bold Q: questions in the FAQ section and pairs them with the next paragraph
  function extractFaqItems(content: string): { question: string; answer: string }[] {
    const items: { question: string; answer: string }[] = [];
    const faqMatch = content.match(/##[^\n]*(?:FAQ|Frequently Asked|Common Questions?)[^\n]*\n([\s\S]+?)(?=\n##|$)/i);
    if (!faqMatch) return items;
    const body = faqMatch[1];
    const pattern = /\*\*Q[^*]*\?[^*]*\*\*\s*\n+((?:[^*\n#][^\n]*\n?)+)/g;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(body)) !== null && items.length < 10) {
      const qMatch = m[0].match(/\*\*([^*]+)\*\*/);
      if (qMatch) {
        items.push({
          question: qMatch[1].replace(/^Q\d*[:.]\s*/i, "").trim(),
          answer: m[1].replace(/\n+/g, " ").trim().substring(0, 400),
        });
      }
    }
    return items;
  }
  const faqItems = extractFaqItems(finalContent);

  // ── AEO SIGNALS ─────────────────────────────────────────────────────────────
  const hasFaq =
    contentLower.includes("?") &&
    (contentLower.includes("faq") ||
      contentLower.includes("frequently asked") ||
      (finalContent.match(/\?/g)?.length ?? 0) >= 5);
  const hasNumberedLists = /^\d+\./m.test(finalContent);
  const hasHeadings = /^#{1,3}\s/m.test(finalContent);

  // ── GEO SIGNALS ─────────────────────────────────────────────────────────────
  const indiaKeywords = ["india", "indian", "ayurvedic", "ayush", "desi", "hindi", "rupee", "lakh"];
  const locationSignals = indiaKeywords.filter((k) => contentLower.includes(k));

  return {
    content: finalContent,
    pass1_content: pass1Content,
    compliance,
    plagiarism,
    seo: {
      keywords_found: keywordsFound,
      keywords_missing: keywordsMissing,
      word_count: wordCount,
      readability,
      meta_title: metaTitle,
      meta_description: metaDescription,
      url_slug: req.topic.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, "-").substring(0, 80),
      suggested_schema: JSON.stringify(
        faqItems.length > 0
          ? [
              {
                "@context": "https://schema.org",
                "@type": "BlogPosting",
                "headline": metaTitle,
                "description": metaDescription,
                "author": { "@type": "Organization", "name": "Story Digital" },
                "publisher": {
                  "@type": "Organization",
                  "name": "Story Digital",
                  "logo": { "@type": "ImageObject", "url": "https://www.storydigital.in/logo.png" }
                },
                "datePublished": new Date().toISOString(),
                "dateModified": new Date().toISOString(),
                "wordCount": wordCount,
                "keywords": req.keywords.join(", "),
                "articleSection": "Health & Wellness",
                "inLanguage": "en-IN",
                "about": { "@type": "Thing", "name": req.topic }
              },
              {
                "@context": "https://schema.org",
                "@type": "FAQPage",
                "mainEntity": faqItems.map(item => ({
                  "@type": "Question",
                  "name": item.question,
                  "acceptedAnswer": { "@type": "Answer", "text": item.answer }
                }))
              }
            ]
          : {
              "@context": "https://schema.org",
              "@type": "BlogPosting",
              "headline": metaTitle,
              "description": metaDescription,
              "author": { "@type": "Organization", "name": "Story Digital" },
              "publisher": {
                "@type": "Organization",
                "name": "Story Digital",
                "logo": { "@type": "ImageObject", "url": "https://www.storydigital.in/logo.png" }
              },
              "datePublished": new Date().toISOString(),
              "dateModified": new Date().toISOString(),
              "wordCount": wordCount,
              "keywords": req.keywords.join(", "),
              "articleSection": "Health & Wellness",
              "inLanguage": "en-IN",
              "about": { "@type": "Thing", "name": req.topic }
            },
        null,
        2
      ),
    },
    aeo: {
      has_faq_structure: hasFaq,
      has_numbered_lists: hasNumberedLists,
      has_headings: hasHeadings,
      citation_signals: warnings.slice(0, 2),
    },
    geo: {
      india_context: true,
      location_signals: locationSignals,
      ai_overview_ready: hasHeadings && hasFaq,
    },
    tokens: {
      pass1_input: p1InputTokens,
      pass1_output: p1OutputTokens,
      pass2_input: p2InputTokens,
      pass2_output: p2OutputTokens,
      total: totalTokens,
    },
    cost_inr: parseFloat(totalCost.toFixed(4)),
    cost_breakdown: {
      pass1_cost: parseFloat(pass1Cost.toFixed(4)),
      pass2_cost: parseFloat(pass2Cost.toFixed(4)),
      stealth_cost: parseFloat(stealthCostInr.toFixed(4)),
      dataforseo_cost: parseFloat(dataforseoCostInr.toFixed(4)),
      copyscape_cost: parseFloat(copyscapeCostInr.toFixed(4)),
      total_cost: parseFloat(totalCost.toFixed(4)),
    },
    human_score: stealthResult.humanScore,
    keyword_data: keywordData,
    model: MODEL,
  };
}
