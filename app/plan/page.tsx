"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload, Loader2, CheckCircle2, XCircle, ExternalLink,
  ChevronDown, ChevronUp, CheckCircle, AlertTriangle,
} from "lucide-react";
import clsx from "clsx";
import { PLAN_DATA, type PlanBlog } from "@/lib/plan-data";

// ── Types ─────────────────────────────────────────────────────────────────────
interface MinimalResult {
  blogId: number;
  compliance: boolean;
  humanScore: number;
  wordCount: number;
  costInr: number;
  metaTitle: string;
}

type BlogStatus =
  | { type: "pending" }
  | { type: "generating" }
  | { type: "done"; result: MinimalResult }
  | { type: "error"; message: string };

// ── Constants ─────────────────────────────────────────────────────────────────
const BRANDS = [
  { value: "gas_o_fast", label: "Gas-O-Fast" },
  { value: "healthok", label: "HealthOK" },
  { value: "nimulid", label: "Nimulid Strong" },
];

const BRAND_AUDIENCE: Record<string, string> = {
  gas_o_fast: "general",
  healthok: "patients",
  nimulid: "general",
};

const WORD_COUNTS = [
  { value: "1200", label: "1200 words" },
  { value: "800", label: "800 words" },
  { value: "2000", label: "2000 words" },
  { value: "500", label: "500 words" },
];

const AGENT_STEPS = [
  { name: "Research Agent", detail: "Indexing topic · fetching related medical terms" },
  { name: "Compliance Pre-Scanner", detail: "Loading CDSCO ruleset · Drug & Cosmetics Act §3.1" },
  { name: "Writing Agent — Pass 1", detail: "Claude Opus 4.8 · Medical accuracy & SEO structure" },
  { name: "Brand Voice Agent — Pass 2", detail: "Claude Opus 4.8 · Brand personality & humanisation" },
  { name: "StealthGPT Humanizer", detail: "AI-detection bypass · burstiness correction" },
  { name: "Plagiarism Scanner", detail: "Copyscape Premium · live web comparison" },
  { name: "SEO Intelligence", detail: "DataForSEO · India search volume & keyword metrics" },
  { name: "Compliance Validator", detail: "Final pharma safety sweep · risk scoring" },
];

// Step timing in ms — matches approximate real pipeline duration
const STEP_TIMINGS = [0, 2500, 5500, 26000, 38000, 42000, 45000, 48000];

// ── Component ─────────────────────────────────────────────────────────────────
export default function PlanPage() {
  const [brand, setBrand] = useState("gas_o_fast");
  const [targetLength, setTargetLength] = useState("1200");
  const [statuses, setStatuses] = useState<Record<string, BlogStatus>>({});
  const [agentProgress, setAgentProgress] = useState<Record<string, { active: number; done: number[] }>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [customBlogs, setCustomBlogs] = useState<PlanBlog[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRefs = useRef<Record<string, ReturnType<typeof setTimeout>[]>>({});

  const blogs: PlanBlog[] = customBlogs ?? PLAN_DATA[brand] ?? [];

  function statusKey(index: number) {
    return `${brand}-${index}`;
  }

  function toggleExpanded(key: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // Load already-generated statuses from DB on brand change
  const loadGeneratedStatuses = useCallback(async (selectedBrand: string, planBlogs: PlanBlog[]) => {
    try {
      const res = await fetch(`/api/blogs?brand=${selectedBrand}`);
      if (!res.ok) return;
      const generated: { id: number; topic: string; compliance_passed: number; human_score: number; word_count: number; cost_inr: number; meta_title: string }[] = await res.json();
      setStatuses(prev => {
        const next = { ...prev };
        planBlogs.forEach((blog, i) => {
          const key = `${selectedBrand}-${i}`;
          if (!prev[key] || prev[key].type === "pending") {
            const match = generated.find(b => b.topic.trim().toLowerCase() === blog.blog_title.trim().toLowerCase());
            if (match) {
              next[key] = {
                type: "done",
                result: {
                  blogId: match.id,
                  compliance: match.compliance_passed === 1,
                  humanScore: match.human_score ?? 0,
                  wordCount: match.word_count ?? 0,
                  costInr: match.cost_inr ?? 0,
                  metaTitle: match.meta_title ?? "",
                },
              };
            }
          }
        });
        return next;
      });
    } catch { /* fail silently */ }
  }, []);

  useEffect(() => {
    const planBlogs = customBlogs ?? PLAN_DATA[brand] ?? [];
    loadGeneratedStatuses(brand, planBlogs);
  }, [brand, customBlogs, loadGeneratedStatuses]);

  // Start agent step animation for a given key
  function startAgentAnimation(key: string) {
    timerRefs.current[key]?.forEach(clearTimeout);
    timerRefs.current[key] = [];
    setAgentProgress(prev => ({ ...prev, [key]: { active: 0, done: [] } }));

    STEP_TIMINGS.forEach((ms, i) => {
      const t = setTimeout(() => {
        setAgentProgress(prev => ({
          ...prev,
          [key]: { active: i, done: Array.from({ length: i }, (_, j) => j) },
        }));
      }, ms);
      timerRefs.current[key].push(t);
    });
  }

  async function generateBlog(index: number) {
    const blog = blogs[index];
    const key = statusKey(index);

    // Auto-expand the row to show agent steps
    setExpanded(prev => { const n = new Set(prev); n.add(key); return n; });
    setStatuses(prev => ({ ...prev, [key]: { type: "generating" } }));
    startAgentAnimation(key);

    const keywords = [blog.primary_keyword, ...blog.secondary_keywords.split(",").map(k => k.trim())]
      .filter(Boolean).slice(0, 6);

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand,
        topic: blog.blog_title,
        keywords: keywords.join(", "),
        target_audience: BRAND_AUDIENCE[brand] ?? "general",
        content_type: blog.content_type || "blog",
        target_length: targetLength,
        primary_keyword: blog.primary_keyword,
        secondary_keywords: blog.secondary_keywords,
        lsi_keywords: blog.lsi_keywords,
        content_angle: blog.content_angle,
        cta_link: blog.cta_link,
      }),
    });

    const data = await res.json();
    timerRefs.current[key]?.forEach(clearTimeout);

    if (!res.ok || data.error) {
      setStatuses(prev => ({ ...prev, [key]: { type: "error", message: data.error ?? "Generation failed" } }));
      setAgentProgress(prev => { const n = { ...prev }; delete n[key]; return n; });
    } else {
      setAgentProgress(prev => ({ ...prev, [key]: { active: AGENT_STEPS.length, done: AGENT_STEPS.map((_, i) => i) } }));
      setStatuses(prev => ({
        ...prev,
        [key]: {
          type: "done",
          result: {
            blogId: data.id,
            compliance: data.compliance?.passed ?? false,
            humanScore: data.human_score ?? 0,
            wordCount: data.seo?.word_count ?? 0,
            costInr: data.cost_inr ?? 0,
            metaTitle: data.seo?.meta_title ?? blog.blog_title,
          },
        },
      }));
    }
  }

  async function handleFile(file: File) {
    setUploading(true);
    setUploadError("");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/plan/parse", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok || data.error) {
      setUploadError(data.error ?? "Failed to parse file");
    } else {
      setCustomBlogs(data.blogs);
      setStatuses({});
      setExpanded(new Set());
    }
    setUploading(false);
  }

  const doneCount = Object.values(statuses).filter(s => s.type === "done").length;
  const errorCount = Object.values(statuses).filter(s => s.type === "error").length;
  const isGenerating = Object.values(statuses).some(s => s.type === "generating");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-semibold text-white tracking-tight">Blog Plan</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Select a brand to see its full content plan. All 8 agents run on every generation — same pipeline as Generate Blog.
        </p>
      </div>

      {/* Controls row */}
      <div className="flex items-end gap-4 flex-wrap">
        {/* Brand */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Brand</label>
          <div className="relative">
            <select
              value={brand}
              onChange={e => { setBrand(e.target.value); setExpanded(new Set()); }}
              className="appearance-none bg-white/[0.04] border border-white/[0.09] rounded-xl px-4 py-2.5 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-gold-400/40 pr-8 min-w-[160px]"
            >
              {BRANDS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Word count */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Blog Length</label>
          <div className="grid grid-cols-4 gap-2">
            {([
              { value: "500", label: "Short", sub: "~500w" },
              { value: "800", label: "Standard", sub: "~800w" },
              { value: "1200", label: "Long", sub: "~1200w" },
              { value: "2000", label: "Pillar", sub: "~2000w" },
            ] as const).map(opt => (
              <button
                key={opt.value}
                onClick={() => setTargetLength(opt.value)}
                className={clsx(
                  "flex flex-col items-center py-2 px-3 rounded-xl border text-center transition-all",
                  targetLength === opt.value
                    ? "bg-gold-400/10 border-gold-400/40 text-gold-300"
                    : "bg-white/[0.03] border-white/[0.08] text-zinc-500 hover:border-white/20 hover:text-zinc-300"
                )}
              >
                <span className="text-xs font-semibold">{opt.label}</span>
                <span className="text-[10px] opacity-70">{opt.sub}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        {blogs.length > 0 && (
          <div className="flex items-center gap-5 pb-0.5 ml-4">
            {[
              { label: "Total", value: blogs.length, color: "text-white" },
              { label: "Done", value: doneCount, color: "text-green-400" },
              { label: "Pending", value: blogs.length - doneCount - errorCount, color: "text-zinc-400" },
              ...(errorCount > 0 ? [{ label: "Errors", value: errorCount, color: "text-red-400" }] : []),
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <p className={clsx("text-lg font-semibold leading-none", color)}>{value}</p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Custom upload */}
        <div className="ml-auto">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 border border-white/[0.06] hover:border-white/10 bg-white/[0.02] rounded-xl px-3.5 py-2.5 transition-all"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {customBlogs ? "Replace plan" : "Import custom plan"}
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      </div>

      {uploadError && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{uploadError}</p>}
      {customBlogs && (
        <div className="flex items-center gap-2 text-xs text-gold-400/80">
          <span>Showing custom plan ({customBlogs.length} blogs)</span>
          <button onClick={() => { setCustomBlogs(null); setStatuses({}); setExpanded(new Set()); }} className="underline hover:text-gold-300">
            Back to built-in plan
          </button>
        </div>
      )}

      {/* Blog cards */}
      <div className="space-y-3">
        {blogs.map((blog, i) => {
          const key = statusKey(i);
          const status = statuses[key] ?? { type: "pending" };
          const isExpanded = expanded.has(key);
          const agent = agentProgress[key];

          return (
            <div
              key={key}
              className={clsx(
                "bg-zinc-900/50 border rounded-2xl overflow-hidden transition-all duration-200",
                status.type === "done" ? "border-green-500/20" :
                status.type === "error" ? "border-red-500/20" :
                status.type === "generating" ? "border-gold-400/20" :
                "border-white/[0.06]"
              )}
            >
              {/* ── Header row ── */}
              <div className="flex items-center gap-4 px-5 py-4">
                {/* Expand toggle */}
                <button
                  onClick={() => toggleExpanded(key)}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors flex-shrink-0"
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {/* Month */}
                <span className="text-xs text-zinc-500 w-20 flex-shrink-0">{blog.month}</span>

                {/* Cluster */}
                <span className="text-[11px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-md border border-white/[0.05] w-32 truncate flex-shrink-0">
                  {blog.cluster}
                </span>

                {/* Title */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{blog.blog_title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-zinc-600 uppercase tracking-wider">{blog.content_type}</span>
                    {status.type === "done" && (
                      <span className="text-[10px] text-zinc-500">·</span>
                    )}
                    {status.type === "done" && (
                      <span className="text-[10px] text-zinc-500 font-mono">{status.result.wordCount} words · ₹{status.result.costInr.toFixed(2)}</span>
                    )}
                  </div>
                </div>

                {/* CTA link */}
                {blog.cta_link && (
                  <a href={blog.cta_link} target="_blank" rel="noopener noreferrer"
                    className="text-[11px] text-gold-400/60 hover:text-gold-400 flex items-center gap-1 flex-shrink-0 transition-colors"
                    onClick={e => e.stopPropagation()}>
                    CTA <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}

                {/* Action */}
                <div className="flex-shrink-0">
                  {status.type === "pending" && (
                    <button onClick={() => generateBlog(i)} disabled={isGenerating}
                      className="text-xs bg-gold-400/10 hover:bg-gold-400/20 text-gold-300 border border-gold-400/20 px-3.5 py-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                      Generate
                    </button>
                  )}
                  {status.type === "generating" && (
                    <span className="flex items-center gap-1.5 text-xs text-gold-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…
                    </span>
                  )}
                  {status.type === "done" && (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        {status.result.compliance
                          ? <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                          : <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                        <span className={clsx("text-[11px] font-semibold",
                          status.result.humanScore >= 80 ? "text-green-400" : status.result.humanScore >= 50 ? "text-amber-400" : "text-red-400")}>
                          {status.result.humanScore}/100
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <a href="/blogs" className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition-colors">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Generated
                        </a>
                        <button onClick={() => generateBlog(i)} disabled={isGenerating}
                          className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors disabled:opacity-40">
                          Regenerate
                        </button>
                      </div>
                    </div>
                  )}
                  {status.type === "error" && (
                    <button onClick={() => generateBlog(i)} disabled={isGenerating}
                      className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-40">
                      <XCircle className="w-3.5 h-3.5" /> Retry
                    </button>
                  )}
                </div>
              </div>

              {/* ── Expanded body ── */}
              {isExpanded && (
                <div className="border-t border-white/[0.05] px-5 py-5 space-y-5">

                  {/* Agent steps — shown while generating */}
                  {status.type === "generating" && agent && (
                    <div className="bg-black/30 border border-white/[0.04] rounded-xl overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-white/[0.04] flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-ping" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-400">
                          AI Orchestrator · {AGENT_STEPS.length} Agents Running
                        </span>
                      </div>
                      <div className="px-3 py-2 space-y-1">
                        {AGENT_STEPS.map((step, si) => {
                          const isDone = agent.done.includes(si);
                          const isActive = agent.active === si;
                          return (
                            <div key={si} className={clsx(
                              "flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
                              isDone && "bg-emerald-400/[0.04]",
                              isActive && "bg-gold-400/[0.06] border border-gold-400/20",
                            )}>
                              <div className="w-4 flex-shrink-0 flex items-center justify-center">
                                {isDone ? <CheckCircle className="w-3 h-3 text-emerald-400" />
                                  : isActive ? <Loader2 className="w-3 h-3 text-gold-400 animate-spin" />
                                  : <span className="text-[9px] font-mono text-zinc-700">{String(si + 1).padStart(2, "0")}</span>}
                              </div>
                              <p className={clsx("text-xs font-medium flex-1",
                                isDone ? "text-emerald-300/80" : isActive ? "text-gold-200" : "text-zinc-600")}>
                                {step.name}
                              </p>
                              {(isDone || isActive) && (
                                <p className="text-[10px] text-zinc-600 font-mono truncate max-w-[200px]">{step.detail}</p>
                              )}
                              <span className={clsx("text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full flex-shrink-0",
                                isDone ? "text-emerald-400 bg-emerald-400/10"
                                : isActive ? "text-gold-400 bg-gold-400/10"
                                : "text-zinc-700 bg-zinc-800/40")}>
                                {isDone ? "Done" : isActive ? "Running" : "Queued"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Error message */}
                  {status.type === "error" && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-xs text-red-300">
                      {status.message}
                    </div>
                  )}

                  {/* Keyword details — always shown when expanded */}
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Primary Keyword</p>
                      <div className="flex flex-wrap gap-1.5">
                        {blog.primary_keyword.split(",").map((k, ki) => (
                          <span key={ki} className="text-[11px] px-2.5 py-1 rounded-lg bg-gold-400/[0.07] border border-gold-400/20 text-gold-300 font-medium">
                            {k.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Secondary Keywords</p>
                      <div className="flex flex-wrap gap-1.5">
                        {blog.secondary_keywords.split(",").map((k, ki) => (
                          <span key={ki} className="text-[11px] px-2 py-0.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-zinc-300">
                            {k.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">LSI / Semantic Keywords</p>
                    <div className="flex flex-wrap gap-1.5">
                      {blog.lsi_keywords.split(",").map((k, ki) => (
                        <span key={ki} className="text-[10px] px-2 py-0.5 rounded-lg bg-zinc-800/60 border border-white/[0.05] text-zinc-500">
                          {k.trim()}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">Content Angle & CTA</p>
                    <p className="text-xs text-zinc-400 leading-relaxed bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3">
                      {blog.content_angle}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
