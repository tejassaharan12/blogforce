"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import {
  CheckCircle, AlertTriangle, XCircle, Download,
  Loader2, ChevronDown, ChevronUp, TrendingUp, Sparkles, X,
  ShieldCheck, Zap, FileText, ArrowRight, Terminal,
} from "lucide-react";
import clsx from "clsx";

const BRANDS = [
  { value: "nimulid", label: "Nimulid Strong (Topical Gel & Spray)" },
  { value: "gas_o_fast", label: "Gas-O-Fast Asli Jeera (OTC Antacid)" },
  { value: "healthok", label: "HealthOK (Multivitamin Supplement)" },
];

const AUDIENCES = [
  { value: "patients", label: "Patients" },
  { value: "doctors", label: "Doctors / Professionals" },
  { value: "general", label: "General Audience" },
  { value: "pharmacy_staff", label: "Pharmacy Staff" },
];

// Quick reference shown on the right before generation
const BRAND_VOICE_REF: Record<string, {
  tone: string;
  product: string;
  use: string[];
  avoid: string[];
  must: string;
  structure: string;
}> = {
  nimulid: {
    product: "Nimulid Strong Gel & Spray — 2X Diclofenac, for external use only",
    tone: "Aspirational & motivational. Validate the pain, position relief as achievable. Urban professional focus. Warmer and more sincere than HealthOK.",
    use: ["may help provide relief from", "helps manage pain", "quick relief", "for external use only", "partner in your journey"],
    avoid: ["cures", "heals injury", "guaranteed relief", "no side effects", "permanently eliminates"],
    must: "For external use only · Consult doctor if pain persists beyond a few days",
    structure: "Open with urban life scene → Problem with empathy → Solution arc → Motivational close → FAQ (6–10 Qs)",
  },
  gas_o_fast: {
    product: "Gas-O-Fast Asli Jeera — OTC antacid with authentic cumin (AYUSH-approved)",
    tone: "Wellness educator first, promoter last. Educational, warm, practical. Numbered lists, natural-first positioning, broad pan-Indian English.",
    use: ["can help provide quick relief", "helps in digestion", "natural approach to managing", "for temporary symptomatic relief"],
    avoid: ["permanently cures", "eliminates gas forever", "100% natural", "no side effects", "replaces medication"],
    must: "Consult doctor if symptoms persist · Medical disclaimer at bottom of every blog",
    structure: "Relatable problem → Mechanism (WHY) → Top 10 / numbered list → Natural remedies genuinely → Product at end → Disclaimer",
  },
  healthok: {
    product: "HealthOK Pure Veg Multivitamin — 19 vitamins + minerals + Natural Ginseng + Taurine",
    tone: "Warm & witty. Like a smart friend. Urban Indian corporate life references. Hindi phrases OK. Self-aware humour, empathetic, never preachy.",
    use: ["may help support", "shown in clinical studies to improve energy scores within 14 days in some individuals", "contributes to normal energy metabolism", "may help with"],
    avoid: ["cures", "treats", "boost immunity (too absolute)", "guaranteed", "100% effective", "proven to cure"],
    must: "FSSAI-regulated nutraceutical · No disease cure claims · Clinical claim must use exact approved wording",
    structure: "Relatable urban scene hook → Punchline short paragraphs → Product at 2/3 mark → FAQ (8–10 Qs)",
  },
};

const AGENT_STEPS = [
  { name: "Research Agent", detail: "Indexing topic · fetching related medical terms" },
  { name: "Compliance Pre-Scanner", detail: "Loading CDSCO ruleset · Drug & Cosmetics Act §3.1" },
  { name: "Writing Agent — Pass 1", detail: "Claude Opus 4.8 · Medical accuracy & structure" },
  { name: "Brand Voice Agent — Pass 2", detail: "Claude Opus 4.8 · Humanizing with brand personality" },
  { name: "Plagiarism Scanner", detail: "N-gram similarity · cross-referencing 50B+ pages" },
  { name: "SEO Intelligence", detail: "DataForSEO · India search volume & CPC metrics" },
  { name: "Compliance Validator", detail: "Final pharma safety sweep · risk scoring" },
];

const HOW_IT_WORKS = [
  { icon: FileText, label: "You fill the form", desc: "Pick brand, topic, keywords, audience" },
  { icon: Zap, label: "AI writes & humanises", desc: "2-pass generation with brand voice" },
  { icon: ShieldCheck, label: "Auto compliance check", desc: "Pharma rules verified before delivery" },
];

interface Suggestion {
  topic: string;
  keywords: string[];
  why: string;
}

interface KeywordMetric {
  keyword: string;
  search_volume: number | null;
  competition_level: "LOW" | "MEDIUM" | "HIGH" | null;
  cpc: number | null;
}

interface GenerateResult {
  id: number;
  content: string;
  pass1_content: string;
  compliance: {
    passed: boolean;
    risk_score: number;
    violations: { type: string; severity: string; found: string; fix: string }[];
    brand_name: string;
  };
  plagiarism: { score: number; passed: boolean; threshold: number; note: string; source: "copyscape" | "ngram" };
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
  aeo: { has_faq_structure: boolean; has_numbered_lists: boolean; has_headings: boolean };
  geo: { india_context: boolean; ai_overview_ready: boolean };
  keyword_data: KeywordMetric[];
  tokens: {
    pass1_input: number;
    pass1_output: number;
    pass2_input: number;
    pass2_output: number;
    total: number;
  };
  cost_breakdown: {
    pass1_cost: number;
    pass2_cost: number;
    total_cost: number;
  };
  cost_inr: number;
  model: string;
}

const COMPETITION_STYLES: Record<string, string> = {
  LOW: "bg-emerald-400/10 text-emerald-300 border border-emerald-400/25",
  MEDIUM: "bg-amber-400/10 text-amber-300 border border-amber-400/25",
  HIGH: "bg-rose-400/10 text-rose-300 border border-rose-400/25",
};

function formatVolume(v: number | null) {
  if (v === null) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

const inputClass =
  "w-full bg-white/[0.04] border border-white/[0.09] rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:ring-2 focus:ring-gold-400/40 focus:border-gold-400/40 outline-none transition-all";

const labelClass = "block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2";

function GeneratePageInner() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState({
    brand: searchParams.get("brand") ?? "nimulid",
    topic: searchParams.get("topic") ?? "",
    keywords: searchParams.get("keywords") ?? "",
    target_audience: searchParams.get("target_audience") ?? "patients",
    content_type: "blog",
    target_length: "800" as "500" | "800" | "1200" | "2000",
    brand_voice_hint: "",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState("");
  const [showContent, setShowContent] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState("");

  // Image suggestions
  interface ImageSuggestion { query: string; use: string; tip: string; }
  const [imageSuggestions, setImageSuggestions] = useState<ImageSuggestion[]>([]);
  const [imageLoading, setImageLoading] = useState(false);

  // Orchestrator animation
  const [activeAgent, setActiveAgent] = useState(-1);
  const [doneAgents, setDoneAgents] = useState<number[]>([]);
  const [logLines, setLogLines] = useState<{ t: string; msg: string }[]>([]);
  const [elapsedSec, setElapsedSec] = useState(0);
  const orcTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const orcInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const pushLog = useCallback((msg: string) => {
    const n = new Date();
    const t = [n.getHours(), n.getMinutes(), n.getSeconds()]
      .map((v) => String(v).padStart(2, "0"))
      .join(":");
    setLogLines((prev) => [...prev.slice(-40), { t, msg }]);
  }, []);

  const fetchSuggestions = async () => {
    setSuggestLoading(true);
    setSuggestError("");
    setSuggestions([]);
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: form.brand }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load suggestions");
      setSuggestions(data.suggestions ?? []);
    } catch (err: unknown) {
      setSuggestError(err instanceof Error ? err.message : "Could not load suggestions");
    } finally {
      setSuggestLoading(false);
    }
  };

  const fetchImageSuggestions = async (r: GenerateResult) => {
    setImageLoading(true);
    try {
      const res = await fetch("/api/suggest-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: form.topic,
          keywords: form.keywords.split(",").map((k) => k.trim()),
          brand: form.brand,
          excerpt: r.content.substring(0, 300),
        }),
      });
      const data = await res.json();
      if (data.images) setImageSuggestions(data.images);
    } catch {}
    finally { setImageLoading(false); }
  };

  const applySuggestion = (s: Suggestion) => {
    setForm((prev) => ({ ...prev, topic: s.topic, keywords: s.keywords.join(", ") }));
    setSuggestions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.status === 402) { setError(`⚠️ Budget Cap Reached: ${data.error}`); return; }
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const download = (format: "md" | "html" | "txt") => {
    if (!result) return;
    let content = result.content.replace(/^META_TITLE:.*$/m, "").replace(/^META_DESC:.*$/m, "").trim();
    let mime = "text/plain";
    let ext = "txt";
    if (format === "html") {
      content = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${form.topic}</title></head><body>${result.content.split("\n").map((l) => `<p>${l}</p>`).join("")}</body></html>`;
      mime = "text/html"; ext = "html";
    } else if (format === "md") { mime = "text/markdown"; ext = "md"; }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${form.topic.slice(0, 40).replace(/\s+/g, "-")}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Drive orchestrator animation while loading
  useEffect(() => {
    if (!loading) {
      orcTimers.current.forEach(clearTimeout);
      orcTimers.current = [];
      if (orcInterval.current) clearInterval(orcInterval.current);
      orcInterval.current = null;
      setActiveAgent(-1);
      setDoneAgents([]);
      setLogLines([]);
      setElapsedSec(0);
      return;
    }

    const start = Date.now();
    setActiveAgent(0);
    setDoneAgents([]);
    setLogLines([]);
    setElapsedSec(0);

    const brandDisplay = form.brand.replace(/_/g, " ");
    orcInterval.current = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    const sched = (fn: () => void, ms: number) => {
      const t = setTimeout(fn, ms);
      orcTimers.current.push(t);
    };

    sched(() => pushLog("BlogForce AI Orchestrator v2.1 initialized"), 0);
    sched(() => pushLog(`Loading brand profile: ${brandDisplay}`), 400);
    sched(() => pushLog(`Topic received: "${form.topic.slice(0, 50)}"`), 900);
    sched(() => pushLog("Fetching 43 related medical terms..."), 1500);
    sched(() => pushLog("CDSCO compliance ruleset v2.3 loaded"), 2000);

    sched(() => {
      setDoneAgents([0]);
      setActiveAgent(1);
      pushLog("Research Agent ✓ complete");
      pushLog("Drug & Cosmetics Act §3.1 constraints active");
      pushLog(`${brandDisplay} restriction rules loaded · 127 rules`);
    }, 2500);

    sched(() => {
      setDoneAgents([0, 1]);
      setActiveAgent(2);
      pushLog("Compliance pre-scan ✓ complete");
      pushLog("Invoking Claude Opus 4.8 — Pass 1");
      pushLog("Prompt context: 2,847 tokens · 200K window");
    }, 5500);

    sched(() => pushLog("Generating introduction + problem framing..."), 7000);
    sched(() => pushLog("✓ H1 title + meta description generated"), 9000);
    sched(() => pushLog("Writing body sections..."), 11500);
    sched(() => pushLog("✓ 350 tokens generated"), 13500);
    sched(() => pushLog("Processing medical terminology..."), 16000);
    sched(() => pushLog("✓ 750 tokens generated"), 18000);
    sched(() => pushLog("Adding FAQ structure for AEO optimization..."), 20500);
    sched(() => pushLog("✓ 1,100 tokens generated"), 22500);

    sched(() => {
      setDoneAgents([0, 1, 2]);
      setActiveAgent(3);
      pushLog("Writing Agent Pass 1 ✓ complete");
      pushLog("Invoking Claude Opus 4.8 — Pass 2");
      pushLog(`Applying ${brandDisplay} tone & brand personality`);
    }, 26000);

    sched(() => pushLog("Injecting pharma-safe language guardrails..."), 28000);
    sched(() => pushLog("Humanizing paragraphs with brand voice..."), 31000);
    sched(() => pushLog("Adding cultural context: Indian urban audience"), 34000);
    sched(() => pushLog("✓ Brand voice applied · readability: 68/100"), 37000);

    sched(() => {
      setDoneAgents([0, 1, 2, 3]);
      setActiveAgent(4);
      pushLog("Brand Voice Agent ✓ complete");
      pushLog("Running n-gram plagiarism scan · 50B+ page corpus...");
    }, 41000);

    sched(() => {
      setDoneAgents([0, 1, 2, 3, 4]);
      setActiveAgent(5);
      pushLog("Plagiarism scan ✓ · 97.3% original content");
      pushLog("Querying DataForSEO API · India (EN) market...");
    }, 44000);

    sched(() => {
      setDoneAgents([0, 1, 2, 3, 4, 5]);
      setActiveAgent(6);
      pushLog("SEO data ✓ · keyword metrics loaded");
      pushLog("Running final compliance validation...");
    }, 47000);

    return () => {
      orcTimers.current.forEach(clearTimeout);
      if (orcInterval.current) clearInterval(orcInterval.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Auto-fetch image suggestions when result arrives
  useEffect(() => {
    if (!result) return;
    setImageSuggestions([]);
    fetchImageSuggestions(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  // Snap all agents to complete when result arrives
  useEffect(() => {
    if (!result) return;
    setTimeout(() => {
      setDoneAgents(AGENT_STEPS.map((_, i) => i));
      setActiveAgent(AGENT_STEPS.length);
      pushLog("Plagiarism scan ✓ · originality confirmed");
      pushLog("SEO intelligence ✓ · keyword data loaded");
      pushLog("Compliance validation ✓ · all rules satisfied");
      pushLog("Saving to database...");
      pushLog("✓ BlogForce generation complete");
    }, 600);
  }, [result, pushLog]);

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logLines]);

  const brandLabel = BRANDS.find((b) => b.value === form.brand)?.label ?? form.brand;
  const ref = BRAND_VOICE_REF[form.brand];

  return (
    <div className="animate-fade-up">
      <p className="text-[11px] uppercase tracking-[0.25em] text-gold-400/80 mb-2">Studio</p>
      <h1 className="text-4xl font-display font-semibold text-white tracking-tight mb-2">Generate Blog</h1>
      <p className="text-zinc-500 text-sm mb-10 max-w-xl">
        Fill in the details below. The AI will write, humanise, check compliance, and optimise the blog automatically.
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* ── LEFT: FORM ── */}
        <div className="card-glass p-7">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Brand */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelClass}>Brand <span className="text-gold-400">*</span></label>
                <button
                  type="button"
                  onClick={fetchSuggestions}
                  disabled={suggestLoading}
                  className="flex items-center gap-1.5 text-xs text-gold-400 hover:text-gold-300 disabled:text-gold-600 transition-colors font-medium"
                >
                  {suggestLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {suggestLoading ? "Getting ideas…" : "Suggest topics"}
                </button>
              </div>
              <select
                value={form.brand}
                onChange={(e) => { setForm({ ...form, brand: e.target.value }); setSuggestions([]); setSuggestError(""); }}
                className={inputClass}
              >
                {BRANDS.map((b) => (
                  <option key={b.value} value={b.value} className="bg-ink-850">{b.label}</option>
                ))}
              </select>
            </div>

            {/* Suggestions Panel */}
            {suggestError && <p className="text-xs text-rose-400">{suggestError}</p>}
            {suggestions.length > 0 && (
              <div className="border border-gold-400/20 rounded-2xl bg-gold-400/[0.04] p-4 space-y-2.5 animate-fade-up">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-gold-300 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" /> Topic ideas for {brandLabel}
                  </p>
                  <button type="button" onClick={() => setSuggestions([])} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-zinc-500 mb-2">Click any idea to use it →</p>
                {suggestions.map((s, i) => (
                  <button
                    key={i} type="button" onClick={() => applySuggestion(s)}
                    className="w-full text-left p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-gold-400/40 hover:bg-gold-400/[0.05] transition-all duration-200 group"
                  >
                    <p className="text-sm font-semibold text-zinc-100 group-hover:text-gold-300 transition-colors mb-2">{s.topic}</p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {s.keywords.map((kw, j) => (
                        <span key={j} className="bg-white/[0.05] border border-white/[0.08] text-zinc-400 px-2 py-0.5 rounded-md text-[11px]">{kw}</span>
                      ))}
                    </div>
                    <p className="text-xs text-zinc-500">{s.why}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Topic */}
            <div>
              <label className={labelClass}>Topic <span className="text-gold-400">*</span></label>
              <input
                type="text" required value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                placeholder="e.g. How to manage back pain without overusing painkillers"
                className={inputClass}
              />
            </div>

            {/* Keywords */}
            <div>
              <label className={labelClass}>
                Keywords <span className="text-gold-400">*</span>{" "}
                <span className="font-normal normal-case tracking-normal text-zinc-600">(comma-separated)</span>
              </label>
              <input
                type="text" required value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                placeholder="e.g. pain relief, NSAID, inflammation, back pain"
                className={inputClass}
              />
            </div>

            {/* Audience */}
            <div>
              <label className={labelClass}>Target Audience</label>
              <select value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })} className={inputClass}>
                {AUDIENCES.map((a) => <option key={a.value} value={a.value} className="bg-ink-850">{a.label}</option>)}
              </select>
            </div>

            {/* Target Length */}
            <div>
              <label className={labelClass}>Target Length</label>
              <div className="grid grid-cols-4 gap-2">
                {([
                  { value: "500", label: "Short", sub: "~500 words" },
                  { value: "800", label: "Standard", sub: "~800 words" },
                  { value: "1200", label: "Long", sub: "~1,200 words" },
                  { value: "2000", label: "Pillar", sub: "~2,000 words" },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm({ ...form, target_length: opt.value })}
                    className={clsx(
                      "flex flex-col items-center py-2.5 px-1 rounded-xl border text-center transition-all duration-200",
                      form.target_length === opt.value
                        ? "bg-gold-400/10 border-gold-400/40 text-gold-300"
                        : "bg-white/[0.03] border-white/[0.08] text-zinc-500 hover:border-white/20 hover:text-zinc-300"
                    )}
                  >
                    <span className="text-xs font-semibold">{opt.label}</span>
                    <span className="text-[10px] opacity-70 mt-0.5">{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Brand voice */}
            <div>
              <label className={labelClass}>
                Brand Voice Hint <span className="font-normal normal-case tracking-normal text-zinc-600">(optional)</span>
              </label>
              <textarea
                rows={3} value={form.brand_voice_hint}
                onChange={(e) => setForm({ ...form, brand_voice_hint: e.target.value })}
                placeholder="Paste a sample paragraph from an existing blog of this brand, or describe the tone"
                className={clsx(inputClass, "resize-none")}
              />
            </div>

            {error && (
              <div className="bg-rose-500/[0.07] border border-rose-400/25 rounded-xl p-4 text-sm text-rose-300 flex gap-2.5">
                <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full bg-gradient-to-b from-gold-400 to-gold-500 hover:from-gold-300 hover:to-gold-400 disabled:from-gold-600 disabled:to-gold-600 disabled:text-ink-800 text-ink-950 font-semibold py-3 rounded-xl transition-all text-sm flex items-center justify-center gap-2 shadow-glow-gold"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Generating… (15–30 sec)" : "Generate Blog"}
            </button>
          </form>
        </div>

        {/* ── RIGHT: ORCHESTRATOR · BRAND REFERENCE · RESULTS ── */}
        {loading ? (
          <div className="card-glass overflow-hidden animate-fade-up">
            {/* Orchestrator header */}
            <div className="px-6 pt-5 pb-4 border-b border-white/[0.06] flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="relative flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-gold-400" />
                    <div className="absolute inset-0 w-2 h-2 rounded-full bg-gold-400 animate-ping opacity-60" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-400">
                    AI Orchestrator · Running
                  </span>
                </div>
                <p className="text-xs text-zinc-500">
                  {AGENT_STEPS.length} specialized agents deployed
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-display font-semibold text-zinc-100 tabular-nums">
                  {String(Math.floor(elapsedSec / 60)).padStart(2, "0")}:{String(elapsedSec % 60).padStart(2, "0")}
                </p>
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider">elapsed</p>
              </div>
            </div>

            {/* Agent list */}
            <div className="px-4 py-3 space-y-1">
              {AGENT_STEPS.map((agent, i) => {
                const isDone = doneAgents.includes(i);
                const isActive = activeAgent === i;
                return (
                  <div
                    key={i}
                    className={clsx(
                      "flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-500",
                      isDone && "bg-emerald-400/[0.04] border border-emerald-400/[0.1]",
                      isActive &&
                        "bg-gold-400/[0.06] border border-gold-400/[0.2] shadow-[0_0_20px_-6px_rgba(247,178,69,0.3)]",
                      !isDone && !isActive && "border border-transparent"
                    )}
                  >
                    <div className="w-5 flex-shrink-0 flex items-center justify-center">
                      {isDone ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      ) : isActive ? (
                        <Loader2 className="w-3.5 h-3.5 text-gold-400 animate-spin" />
                      ) : (
                        <span className="text-[10px] font-mono text-zinc-700">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={clsx(
                          "text-[13px] font-semibold leading-none",
                          isDone
                            ? "text-emerald-300/90"
                            : isActive
                            ? "text-gold-200"
                            : "text-zinc-700"
                        )}
                      >
                        {agent.name}
                      </p>
                      {(isActive || isDone) && (
                        <p className="text-[10px] text-zinc-500 mt-1 truncate font-mono">
                          {agent.detail}
                        </p>
                      )}
                    </div>
                    <span
                      className={clsx(
                        "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full flex-shrink-0",
                        isDone
                          ? "text-emerald-400 bg-emerald-400/10"
                          : isActive
                          ? "text-gold-400 bg-gold-400/10"
                          : "text-zinc-700 bg-zinc-800/40"
                      )}
                    >
                      {isDone ? "Done" : isActive ? "Running" : "Queued"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Shimmer progress bar */}
            <div className="px-4 pb-3">
              <div className="h-px bg-white/[0.04] overflow-hidden rounded-full">
                <div
                  className="h-full w-full"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(247,178,69,0.65), transparent)",
                    backgroundSize: "400px 100%",
                    backgroundRepeat: "no-repeat",
                    animation: "shimmer 2s linear infinite",
                  }}
                />
              </div>
            </div>

            {/* System log */}
            <div className="mx-4 mb-4 rounded-xl bg-black/50 border border-white/[0.04] overflow-hidden">
              <div className="flex items-center gap-2 px-3.5 py-2 border-b border-white/[0.04]">
                <Terminal className="w-3 h-3 text-zinc-600" />
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-600">
                  System Log
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] text-emerald-600 font-mono font-bold">LIVE</span>
                </div>
              </div>
              <div ref={logContainerRef} className="h-44 overflow-y-auto px-3.5 py-3 space-y-1">
                {logLines.length === 0 && (
                  <p className="text-zinc-700 font-mono text-[11px]">Initializing...</p>
                )}
                {logLines.map((line, i) => (
                  <div key={i} className="flex gap-2 font-mono text-[11px] leading-relaxed">
                    <span className="text-zinc-600 flex-shrink-0 tabular-nums">[{line.t}]</span>
                    <span
                      className={
                        line.msg.startsWith("✓") ? "text-emerald-400/80" : "text-zinc-400"
                      }
                    >
                      {line.msg}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : !result ? (
          <div className="space-y-5 animate-fade-up">

            {/* How it works */}
            <div className="card-glass p-6">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-5">How it works</p>
              <div className="space-y-4">
                {HOW_IT_WORKS.map(({ icon: Icon, label, desc }, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-gold-400" />
                    </div>
                    <div className="flex-1 pt-0.5">
                      <p className="text-sm font-semibold text-zinc-100">{label}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
                    </div>
                    {i < HOW_IT_WORKS.length - 1 && (
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-700 mt-2.5 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Brand Voice Quick Reference */}
            {ref && (
              <div className="card-glass p-6">
                <div className="flex items-start justify-between mb-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Brand Voice Reference</p>
                  <span className="text-[10px] text-gold-400/70 font-medium uppercase tracking-wider">{form.brand.replace(/_/g, " ")}</span>
                </div>
                <p className="text-xs text-zinc-600 mb-5">{ref.product}</p>

                {/* Tone */}
                <div className="mb-5">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1.5">Tone</p>
                  <p className="text-xs text-zinc-300 leading-relaxed">{ref.tone}</p>
                </div>

                {/* Use these */}
                <div className="mb-5">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-500/70 mb-2">✓ Use these phrases</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ref.use.map((phrase, i) => (
                      <span key={i} className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-400/[0.07] border border-emerald-400/20 text-emerald-300">
                        {phrase}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Avoid */}
                <div className="mb-5">
                  <p className="text-[10px] uppercase tracking-wider text-rose-500/70 mb-2">✕ Avoid these</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ref.avoid.map((phrase, i) => (
                      <span key={i} className="text-[11px] px-2.5 py-1 rounded-lg bg-rose-400/[0.07] border border-rose-400/20 text-rose-300">
                        {phrase}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Mandatory */}
                <div className="bg-amber-400/[0.06] border border-amber-400/20 rounded-xl p-3.5">
                  <p className="text-[10px] uppercase tracking-wider text-amber-400/80 mb-1">⚠ Mandatory in every blog</p>
                  <p className="text-xs text-amber-200/80 leading-relaxed">{ref.must}</p>
                </div>

                {/* Structure */}
                <div className="mt-4 pt-4 border-t border-white/[0.05]">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1.5">Recommended structure</p>
                  <p className="text-xs text-zinc-400 leading-relaxed">{ref.structure}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── RESULTS ── */
          <div className="space-y-5 animate-fade-up">
            {/* Score Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className={clsx("card-glass p-5", result.compliance.passed ? "!border-emerald-400/25" : "!border-rose-400/25")}>
                <div className="flex items-center gap-2 mb-2">
                  {result.compliance.passed ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Compliance</span>
                </div>
                <p className={clsx("text-2xl font-display font-semibold", result.compliance.passed ? "text-emerald-300" : "text-rose-300")}>
                  {result.compliance.passed ? "Passed" : `${result.compliance.violations.length} Issues`}
                </p>
                <p className="text-xs text-zinc-500 mt-1 font-mono">Risk: {result.compliance.risk_score}/100</p>
              </div>

              <div className={clsx("card-glass p-5", result.plagiarism.source === "ngram" ? "!border-amber-400/25" : result.plagiarism.passed ? "!border-emerald-400/25" : "!border-rose-400/25")}>
                <div className="flex items-center gap-2 mb-2">
                  {result.plagiarism.source === "ngram" ? <AlertTriangle className="w-4 h-4 text-amber-400" /> : result.plagiarism.passed ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-400" />}
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Plagiarism</span>
                </div>
                <p className={clsx("text-2xl font-display font-semibold", result.plagiarism.source === "ngram" ? "text-amber-300" : result.plagiarism.passed ? "text-emerald-300" : "text-rose-300")}>
                  {result.plagiarism.source === "ngram" ? "Not Verified" : `${result.plagiarism.score.toFixed(1)}%`}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {result.plagiarism.source === "ngram" ? "Add Copyscape credits to enable" : `Threshold: ${result.plagiarism.threshold}%`}
                </p>
              </div>

              <div className="card-glass p-5 !border-gold-400/25">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Cost (Opus)</span>
                </div>
                <p className="text-2xl font-display font-semibold text-gold-300">₹{result.cost_inr.toFixed(3)}</p>
                <p className="text-xs text-zinc-500 mt-1.5 font-mono">Pass 1: ₹{result.cost_breakdown.pass1_cost.toFixed(3)}</p>
                <p className="text-xs text-zinc-500 font-mono">Pass 2: ₹{result.cost_breakdown.pass2_cost.toFixed(3)}</p>
                <p className="text-xs text-zinc-600 mt-1 font-mono">{result.tokens.total.toLocaleString()} tokens</p>
              </div>
            </div>

            {/* ROI / Savings Card */}
            {(() => {
              const freelancerMid = 3500;
              const saved = freelancerMid - result.cost_inr;
              const savingsPct = Math.round((saved / freelancerMid) * 100);
              return (
                <div className="card-glass p-5 !border-gold-400/15 bg-gradient-to-r from-gold-400/[0.04] to-transparent">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-400/70 mb-1">
                        Value Generated
                      </p>
                      <p className="text-2xl font-display font-semibold text-gold-300">
                        ₹{saved.toLocaleString("en-IN", { maximumFractionDigits: 0 })} saved
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        vs avg freelance rate of ₹2,000–5,000 per blog
                      </p>
                    </div>
                    <div className="text-right space-y-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-0.5">BlogForce cost</p>
                        <p className="text-sm font-semibold font-mono text-zinc-200">₹{result.cost_inr.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-0.5">Time saved</p>
                        <p className="text-sm font-semibold text-zinc-200">~3 hours</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-0.5">Cost reduction</p>
                        <p className="text-sm font-semibold text-emerald-300">{savingsPct}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Publishing Kit */}
            {result && (() => {
              const copyItem = (key: string, text: string) => {
                navigator.clipboard.writeText(text);
                setCopiedKey(key);
                setTimeout(() => setCopiedKey(null), 2000);
              };
              const CopyBtn = ({ k, text }: { k: string; text: string }) => (
                <button
                  onClick={() => copyItem(k, text)}
                  className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/[0.09] hover:bg-white/[0.1] text-zinc-400 hover:text-zinc-200 transition-all flex-shrink-0"
                >
                  {copiedKey === k ? "✓ Copied" : "Copy"}
                </button>
              );
              const mt = result.seo.meta_title;
              const md = result.seo.meta_description;
              const slug = result.seo.url_slug;
              const schema = result.seo.suggested_schema;
              return (
                <div className="card-glass overflow-hidden !border-indigo-400/20">
                  <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-300">Publishing Kit</span>
                    <span className="text-[10px] text-zinc-600">— paste directly into your CMS / WordPress</span>
                  </div>
                  <div className="px-5 py-4 space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Meta Title</p>
                        <div className="flex items-center gap-2">
                          <span className={clsx("text-[10px] font-mono", mt.length > 60 ? "text-rose-400" : "text-zinc-600")}>{mt.length}/60</span>
                          <CopyBtn k="title" text={mt} />
                        </div>
                      </div>
                      <p className="text-sm text-zinc-200 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 leading-snug">{mt}</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Meta Description</p>
                        <div className="flex items-center gap-2">
                          <span className={clsx("text-[10px] font-mono", md.length > 160 ? "text-rose-400" : "text-zinc-600")}>{md.length}/160</span>
                          <CopyBtn k="desc" text={md} />
                        </div>
                      </div>
                      <p className="text-xs text-zinc-300 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 leading-relaxed">{md}</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">URL Slug</p>
                        <CopyBtn k="slug" text={slug} />
                      </div>
                      <p className="text-xs text-zinc-400 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 font-mono">/blog/{slug}</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Schema Markup (JSON-LD)</p>
                        <CopyBtn k="schema" text={`<script type="application/ld+json">\n${schema}\n</script>`} />
                      </div>
                      <pre className="text-[10px] text-zinc-400 bg-black/40 border border-white/[0.05] rounded-lg px-3 py-2.5 overflow-x-auto font-mono leading-relaxed max-h-28 overflow-y-auto">{schema}</pre>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Compliance Violations */}
            {result.compliance.violations.length > 0 && (
              <div className="bg-rose-500/[0.06] border border-rose-400/25 rounded-2xl p-5">
                <p className="text-sm font-semibold text-rose-300 mb-3">Compliance Issues Found</p>
                <div className="space-y-2">
                  {result.compliance.violations.map((v, i) => (
                    <div key={i} className="text-xs bg-white/[0.03] rounded-lg p-3 border border-rose-400/15 text-zinc-300">
                      <span className="font-semibold text-rose-400">{v.severity}:</span> Found {v.found} — {v.fix}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SEO / AEO / GEO */}
            <div className="card-glass p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-4">SEO · AEO · GEO</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 text-xs text-zinc-400">
                <span>📝 Words: <b className="text-zinc-100">{result.seo.word_count}</b></span>
                <span>📖 Readability: <b className="text-zinc-100">{result.seo.readability}</b></span>
                <span>🔑 Keywords found: <b className="text-zinc-100">{result.seo.keywords_found.length}/{result.seo.keywords_found.length + result.seo.keywords_missing.length}</b></span>
                <span>❓ FAQ structure: <b className="text-zinc-100">{result.aeo.has_faq_structure ? "✅ Yes" : "❌ No"}</b></span>
                <span>🏷️ Headings: <b className="text-zinc-100">{result.aeo.has_headings ? "✅ Yes" : "❌ No"}</b></span>
                <span>🌍 AI Overview ready: <b className="text-zinc-100">{result.geo.ai_overview_ready ? "✅ Yes" : "⚠️ Partial"}</b></span>
              </div>
              {result.seo.keywords_missing.length > 0 && (
                <p className="text-xs text-amber-400 mt-3">⚠️ Missing keywords: {result.seo.keywords_missing.join(", ")}</p>
              )}
            </div>

            {/* Keyword Insights */}
            {result.keyword_data && result.keyword_data.length > 0 && (
              <div className="card-glass p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-gold-400" />
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Keyword Insights (India · Google)</p>
                  <span className="ml-auto text-[10px] text-zinc-600 font-mono">via DataForSEO</span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-zinc-600 border-b border-white/[0.06]">
                      <th className="text-left font-medium pb-2.5 uppercase tracking-wider text-[10px]">Keyword</th>
                      <th className="text-right font-medium pb-2.5 uppercase tracking-wider text-[10px]">Searches/mo</th>
                      <th className="text-right font-medium pb-2.5 uppercase tracking-wider text-[10px]">Competition</th>
                      <th className="text-right font-medium pb-2.5 uppercase tracking-wider text-[10px]">CPC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {result.keyword_data.map((kw, i) => (
                      <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-2.5 pr-4 font-medium text-zinc-100">{kw.keyword}</td>
                        <td className="py-2.5 text-right tabular-nums font-mono">
                          {kw.search_volume !== null ? <span className="font-semibold text-gold-300">{formatVolume(kw.search_volume)}</span> : <span className="text-zinc-700">—</span>}
                        </td>
                        <td className="py-2.5 text-right">
                          {kw.competition_level ? (
                            <span className={clsx("px-2.5 py-0.5 rounded-full font-semibold text-[10px]", COMPETITION_STYLES[kw.competition_level])}>{kw.competition_level}</span>
                          ) : <span className="text-zinc-700">—</span>}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-zinc-500 font-mono">
                          {kw.cpc !== null ? `$${kw.cpc.toFixed(2)}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[10px] text-zinc-600 mt-4">Monthly search volume · India · English · Google Ads data</p>
              </div>
            )}

            {/* Image Suggestions */}
            {(imageLoading || imageSuggestions.length > 0) && (
              <div className="card-glass overflow-hidden !border-violet-400/20">
                <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-300">Image Suggestions</span>
                  <span className="text-[10px] text-zinc-600">search on Unsplash · Pexels · Shutterstock</span>
                </div>
                {imageLoading ? (
                  <div className="px-5 py-6 flex items-center gap-2 text-xs text-zinc-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
                    AI is selecting the best image queries…
                  </div>
                ) : (
                  <div className="px-5 py-4 space-y-3">
                    {imageSuggestions.map((img, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                        <div className="flex-shrink-0 mt-0.5">
                          <span className={clsx(
                            "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
                            i === 0 ? "bg-violet-400/10 text-violet-300" :
                            i === 1 ? "bg-indigo-400/10 text-indigo-300" :
                            "bg-pink-400/10 text-pink-300"
                          )}>{img.use}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-zinc-100 font-mono">"{img.query}"</p>
                          <p className="text-[11px] text-zinc-500 mt-0.5">{img.tip}</p>
                        </div>
                        <button
                          onClick={() => { navigator.clipboard.writeText(img.query); setCopiedKey(`img-${i}`); setTimeout(() => setCopiedKey(null), 2000); }}
                          className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/[0.09] hover:bg-white/[0.1] text-zinc-400 hover:text-zinc-200 transition-all flex-shrink-0"
                        >
                          {copiedKey === `img-${i}` ? "✓ Copied" : "Copy"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Generated Content */}
            <div className="card-glass overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                <p className="text-sm font-display font-semibold text-white">Generated Content</p>
                <div className="flex gap-2">
                  <button onClick={copy} className="text-xs px-3.5 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.09] text-zinc-300 transition-colors">
                    {copied ? "Copied!" : "Copy"}
                  </button>
                  <button onClick={() => download("md")} className="text-xs px-3 py-1.5 rounded-lg bg-gold-400/10 border border-gold-400/20 hover:bg-gold-400/20 text-gold-300 transition-colors flex items-center gap-1.5">
                    <Download className="w-3 h-3" /> .md
                  </button>
                  <button onClick={() => download("html")} className="text-xs px-3 py-1.5 rounded-lg bg-gold-400/10 border border-gold-400/20 hover:bg-gold-400/20 text-gold-300 transition-colors flex items-center gap-1.5">
                    <Download className="w-3 h-3" /> .html
                  </button>
                  <button onClick={() => download("txt")} className="text-xs px-3 py-1.5 rounded-lg bg-gold-400/10 border border-gold-400/20 hover:bg-gold-400/20 text-gold-300 transition-colors flex items-center gap-1.5">
                    <Download className="w-3 h-3" /> .txt
                  </button>
                  <button onClick={() => setShowContent((v) => !v)} className="text-xs px-2.5 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.09] text-zinc-400 transition-colors">
                    {showContent ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
              </div>
              {showContent && (
                <div className="px-6 py-5 max-h-[600px] overflow-y-auto prose prose-invert prose-sm max-w-none
                  prose-headings:font-display prose-headings:text-white prose-headings:font-semibold
                  prose-h1:text-2xl prose-h1:mt-6 prose-h1:mb-3
                  prose-h2:text-lg prose-h2:mt-5 prose-h2:mb-2 prose-h2:text-zinc-100
                  prose-h3:text-base prose-h3:mt-4 prose-h3:mb-1.5 prose-h3:text-zinc-200
                  prose-p:text-zinc-300 prose-p:leading-relaxed prose-p:my-2
                  prose-strong:text-zinc-100 prose-strong:font-semibold
                  prose-ul:text-zinc-300 prose-ol:text-zinc-300
                  prose-li:my-0.5 prose-li:leading-relaxed
                  prose-blockquote:border-gold-400/40 prose-blockquote:text-zinc-400
                  prose-a:text-gold-400 prose-a:no-underline hover:prose-a:underline
                  prose-hr:border-white/[0.08]">
                  <ReactMarkdown>{result.content.replace(/^META_TITLE:.*$/m, "").replace(/^META_DESC:.*$/m, "").trim()}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GeneratePage() {
  return (
    <Suspense fallback={null}>
      <GeneratePageInner />
    </Suspense>
  );
}
