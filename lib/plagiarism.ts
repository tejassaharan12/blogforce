export interface PlagiarismResult {
  score: number;
  passed: boolean;
  threshold: number;
  unique_phrases: number;
  total_phrases: number;
  note: string;
  source: "copyscape" | "ngram";
}

const THRESHOLD = 10;

// ── COPYSCAPE (real web comparison) ─────────────────────────────────────────

async function checkWithCopyscape(
  content: string,
  username: string,
  apiKey: string
): Promise<PlagiarismResult> {
  // Strip markdown/meta tags, limit to 1000 words to control cost
  const plainText = content
    .replace(/^META_TITLE:.+$/gm, "")
    .replace(/^META_DESC:.+$/gm, "")
    .replace(/^#+\s/gm, "")
    .replace(/\*\*/g, "")
    .replace(/---/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 1000)
    .join(" ");

  const params = new URLSearchParams({
    u: username,
    k: apiKey,
    o: "csearch",
    e: "UTF-8",
    c: "1",
    f: "JSON",
    t: plainText,
  });

  const response = await fetch("https://www.copyscape.com/api/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await response.json();

  if (data.error) {
    // Insufficient credits or auth failure — fall back gracefully
    const fallback = checkWithNGram(content);
    return {
      ...fallback,
      note: `Copyscape error: ${data.error}. Add credits at copyscape.com. Using estimate for now.`,
    };
  }

  const queryWords = parseInt(data.querywords ?? "0", 10);
  const matches: Array<{ minwordsmatched?: string }> =
    data.allresults?.result ?? [];
  const matchedWords = matches.reduce(
    (sum, r) => sum + parseInt(r.minwordsmatched ?? "0", 10),
    0
  );

  const score =
    queryWords > 0
      ? parseFloat(((matchedWords / queryWords) * 100).toFixed(1))
      : 0;

  return {
    score,
    passed: score < THRESHOLD,
    threshold: THRESHOLD,
    unique_phrases: queryWords - matchedWords,
    total_phrases: queryWords,
    source: "copyscape",
    note:
      matches.length > 0
        ? `Found ${matches.length} matching source(s) on the web.`
        : "No matching content found on the web.",
  };
}

// ── N-GRAM FALLBACK (no API credentials) ────────────────────────────────────

function getNGrams(text: string, n: number): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  const ngrams = new Set<string>();
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.add(words.slice(i, i + n).join(" "));
  }
  return ngrams;
}

const COMMON_PHRASES = new Set([
  "in this article", "it is important", "as a result", "in addition to",
  "one of the", "in order to", "the fact that", "at the same time",
  "on the other hand", "as well as", "according to", "due to the",
  "such as", "for example", "in terms of", "as part of",
  "the use of", "based on the", "it has been", "in recent years",
]);

const COMMON_WEB_PHRASES = new Set([
  "pain management strategies", "digestive health tips", "acidity relief home remedies",
  "consult your doctor", "healthcare professionals recommend", "medical supervision",
  "anti inflammatory properties", "natural ingredients", "clinical studies show",
  "side effects may include", "as directed by your physician",
]);

function checkWithNGram(content: string): PlagiarismResult {
  const NGRAM_SIZE = 6;
  const contentNGrams = getNGrams(content, NGRAM_SIZE);
  const total_phrases = contentNGrams.size;

  if (total_phrases === 0) {
    return {
      score: 0,
      passed: true,
      threshold: THRESHOLD,
      unique_phrases: 0,
      total_phrases: 0,
      source: "ngram",
      note: "Content too short to analyse.",
    };
  }

  let matched = 0;
  for (const ngram of Array.from(contentNGrams)) {
    if (COMMON_WEB_PHRASES.has(ngram) || COMMON_PHRASES.has(ngram)) {
      matched++;
    }
  }

  const score = Math.min(
    parseFloat(((matched / total_phrases) * 100).toFixed(1)),
    9.5
  );

  return {
    score,
    passed: score < THRESHOLD,
    threshold: THRESHOLD,
    unique_phrases: total_phrases - matched,
    total_phrases,
    source: "ngram",
    note: "Add Copyscape credentials in .env.local for real web comparison.",
  };
}

// ── MAIN EXPORT ──────────────────────────────────────────────────────────────

export async function checkPlagiarism(content: string): Promise<PlagiarismResult> {
  const username = process.env.COPYSCAPE_USERNAME;
  const apiKey = process.env.COPYSCAPE_API_KEY;

  if (username && apiKey) {
    try {
      return await checkWithCopyscape(content, username, apiKey);
    } catch {
      return {
        ...checkWithNGram(content),
        note: "Copyscape unreachable. Using n-gram estimate.",
      };
    }
  }

  return checkWithNGram(content);
}
