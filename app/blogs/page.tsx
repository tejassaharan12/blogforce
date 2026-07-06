"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Blog } from "@/lib/db";
import { CheckCircle, AlertTriangle, Download, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";

const BRAND_COLORS: Record<string, string> = {
  nimulid: "bg-sky-400/10 text-sky-300 border border-sky-400/20",
  gas_o_fast: "bg-orange-400/10 text-orange-300 border border-orange-400/20",
  healthok: "bg-emerald-400/10 text-emerald-300 border border-emerald-400/20",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-white/[0.06] text-zinc-400 border border-white/10",
  approved: "bg-emerald-400/10 text-emerald-300 border border-emerald-400/20",
  needs_review: "bg-rose-400/10 text-rose-300 border border-rose-400/20",
};

export default function BlogsPage() {
  const router = useRouter();
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Blog | null>(null);
  const [showViolations, setShowViolations] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const regenerate = (blog: Blog) => {
    const params = new URLSearchParams({
      brand: blog.brand,
      topic: blog.topic,
      keywords: blog.keywords,
      target_audience: blog.target_audience,
      content_type: blog.content_type,
    });
    router.push(`/generate?${params.toString()}`);
  };

  const copyItem = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  useEffect(() => {
    fetch("/api/blogs")
      .then((r) => r.json())
      .then(setBlogs);
  }, []);

  const updateStatus = async (id: number, status: string) => {
    await fetch("/api/blogs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setBlogs((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status } : b))
    );
    if (selected?.id === id) setSelected((s) => s && { ...s, status });
  };

  const download = (blog: Blog, format: "md" | "txt") => {
    const cleanedContent = blog.content.replace(/^META_TITLE:.*$/m, "").replace(/^META_DESC:.*$/m, "").trim();
    const blob = new Blob([cleanedContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${blog.topic.slice(0, 40).replace(/\s+/g, "-")}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = filter === "all" ? blogs : blogs.filter((b) => b.brand === filter || b.status === filter);

  return (
    <div className="animate-fade-up">
      <p className="text-[11px] uppercase tracking-[0.25em] text-gold-400/80 mb-2">
        Library
      </p>
      <h1 className="text-4xl font-display font-semibold text-white tracking-tight mb-2">
        All Blogs
      </h1>
      <p className="text-zinc-500 text-sm mb-8">View, review and approve generated content</p>

      {/* Filters */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {["all", "nimulid", "gas_o_fast", "healthok", "draft", "approved", "needs_review"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              "px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
              filter === f
                ? "bg-gold-400 text-ink-950 shadow-glow-gold"
                : "bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-white hover:border-white/20"
            )}
          >
            {f.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* List */}
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="card-glass p-10 text-center text-zinc-500 text-sm">
              No blogs found.
            </div>
          )}
          {filtered.map((blog) => (
            <div
              key={blog.id}
              onClick={() => { setSelected(blog); setShowViolations(false); }}
              className={clsx(
                "card-glass p-5 cursor-pointer transition-all duration-200 hover:shadow-card-hover",
                selected?.id === blog.id
                  ? "!border-gold-400/40 shadow-glow-gold"
                  : "hover:border-white/[0.14]"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-100 truncate">{blog.topic}</p>
                  <p className="text-xs text-zinc-500 mt-1 font-mono">
                    {blog.word_count} words · ₹{blog.cost_inr.toFixed(4)} ·{" "}
                    {new Date(blog.created_at).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${BRAND_COLORS[blog.brand] ?? "bg-white/[0.06] text-zinc-400 border border-white/10"}`}>
                    {blog.brand.replace(/_/g, "-")}
                  </span>
                  <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[blog.status] ?? "bg-white/[0.06] text-zinc-400 border border-white/10"}`}>
                    {blog.status.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
              <div className="flex gap-5 mt-3">
                <span className={clsx("flex items-center gap-1.5 text-xs", blog.compliance_passed ? "text-emerald-400" : "text-rose-400")}>
                  {blog.compliance_passed ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  Compliance
                </span>
                <span className="text-xs text-zinc-500">
                  Plagiarism:{" "}
                  {blog.plagiarism_source === "ngram"
                    ? <span className="text-amber-400">Not Verified</span>
                    : <span className={blog.plagiarism_passed ? "text-emerald-400" : "text-rose-400"}>{blog.plagiarism_score.toFixed(1)}% ✓</span>
                  }
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="card-glass overflow-hidden sticky top-6 max-h-[calc(100vh-8rem)] flex flex-col animate-fade-up">
            <div className="px-6 py-5 border-b border-white/[0.06] flex items-start justify-between gap-4">
              <div>
                <p className="font-display font-semibold text-white text-base leading-snug">{selected.topic}</p>
                <p className="text-xs text-zinc-500 mt-1 font-mono">
                  {selected.brand.replace(/_/g, "-")} · {selected.word_count} words
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {!selected.compliance_passed && (
                  <button
                    onClick={() => regenerate(selected)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-rose-400/10 border border-rose-400/20 hover:bg-rose-400/20 text-rose-300 transition-colors flex items-center gap-1.5"
                    title="Re-generate this blog with the same topic and keywords"
                  >
                    <RefreshCw className="w-3 h-3" /> Regenerate
                  </button>
                )}
                <button onClick={() => download(selected, "md")} className="text-xs px-3 py-1.5 rounded-lg bg-gold-400/10 border border-gold-400/20 hover:bg-gold-400/20 text-gold-300 transition-colors flex items-center gap-1.5">
                  <Download className="w-3 h-3" /> .md
                </button>
                <button onClick={() => download(selected, "txt")} className="text-xs px-3 py-1.5 rounded-lg bg-gold-400/10 border border-gold-400/20 hover:bg-gold-400/20 text-gold-300 transition-colors flex items-center gap-1.5">
                  <Download className="w-3 h-3" /> .txt
                </button>
              </div>
            </div>

            {/* Status Actions — fixed, never scrolls */}
            <div className="flex-shrink-0 px-6 py-3.5 border-b border-white/[0.06] flex gap-2 items-center">
              <span className="text-xs text-zinc-500">Mark as:</span>
              {["draft", "approved", "needs_review"].map((s) => (
                <button
                  key={s}
                  onClick={() => updateStatus(selected.id, s)}
                  className={clsx(
                    "text-xs px-3.5 py-1 rounded-full font-medium transition-all",
                    selected.status === s
                      ? "bg-gold-400 text-ink-950"
                      : "bg-white/[0.05] border border-white/[0.08] text-zinc-400 hover:text-white"
                  )}
                >
                  {s.replace(/_/g, " ")}
                </button>
              ))}
            </div>

            {/* Everything below scrolls together */}
            <div className="flex-1 overflow-y-auto">

              {/* Compliance violations — shown first as a warning before reading */}
              {!selected.compliance_passed && (() => {
                let violations: { type: string; severity: string; found: string; fix: string }[] = [];
                try { violations = JSON.parse(selected.compliance_violations); } catch {}
                return violations.length > 0 ? (
                  <div className="mx-6 mt-4 rounded-xl bg-rose-500/[0.06] border border-rose-400/25 overflow-hidden">
                    <button
                      onClick={() => setShowViolations((v) => !v)}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-rose-300 hover:bg-rose-400/[0.04] transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        {violations.length} Compliance Issue{violations.length > 1 ? "s" : ""} — click to review
                      </span>
                      {showViolations ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {showViolations && (
                      <div className="px-4 pb-4 space-y-2">
                        {violations.map((v, i) => (
                          <div key={i} className="bg-white/[0.03] border border-rose-400/15 rounded-lg p-3 text-xs text-zinc-300">
                            <span className="font-bold text-rose-400 uppercase">{v.severity}:</span>{" "}
                            Found <span className="text-rose-200 font-mono">"{v.found}"</span>
                            <p className="text-zinc-400 mt-1">Fix: {v.fix}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null;
              })()}

              {/* Blog content */}
              <div className="px-6 py-5 prose prose-invert prose-sm max-w-none
                prose-headings:font-display prose-headings:text-white prose-headings:font-semibold
                prose-h1:text-xl prose-h1:mt-5 prose-h1:mb-2
                prose-h2:text-base prose-h2:mt-4 prose-h2:mb-1.5 prose-h2:text-zinc-100
                prose-h3:text-sm prose-h3:mt-3 prose-h3:mb-1 prose-h3:text-zinc-200
                prose-p:text-zinc-300 prose-p:leading-relaxed prose-p:my-2
                prose-strong:text-zinc-100 prose-ul:text-zinc-300 prose-ol:text-zinc-300
                prose-li:my-0.5 prose-hr:border-white/[0.08]">
                <ReactMarkdown>{selected.content.replace(/^META_TITLE:.*$/m, "").replace(/^META_DESC:.*$/m, "").trim()}</ReactMarkdown>
              </div>

              {/* Publishing Kit — after the blog, used when ready to post */}
              {(selected.meta_title || selected.url_slug) && (
                <div className="mx-6 mb-6 rounded-xl border border-indigo-400/20 bg-indigo-400/[0.03] overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/[0.05] flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-300">Publishing Kit</span>
                    <span className="text-[10px] text-zinc-600">paste into CMS when ready to post</span>
                  </div>
                  <div className="px-4 py-3 space-y-3">
                    {[
                      { label: "Meta Title", key: "mt", value: selected.meta_title },
                      { label: "Meta Description", key: "md", value: selected.meta_description },
                      { label: "URL Slug", key: "slug", value: `/blog/${selected.url_slug}` },
                    ].map(({ label, key, value }) => value ? (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600">{label}</p>
                          <button
                            onClick={() => copyItem(key, value)}
                            className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] text-zinc-500 hover:text-zinc-200 transition-all"
                          >
                            {copiedKey === key ? "✓ Copied" : "Copy"}
                          </button>
                        </div>
                        <p className="text-[11px] text-zinc-300 font-mono bg-black/20 rounded px-2.5 py-1.5 truncate">{value}</p>
                      </div>
                    ) : null)}
                    {selected.schema_json && selected.schema_json !== "{}" && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600">Schema JSON-LD</p>
                          <button
                            onClick={() => copyItem("schema", `<script type="application/ld+json">\n${selected.schema_json}\n</script>`)}
                            className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] text-zinc-500 hover:text-zinc-200 transition-all"
                          >
                            {copiedKey === "schema" ? "✓ Copied" : "Copy"}
                          </button>
                        </div>
                        <pre className="text-[9px] text-zinc-500 font-mono bg-black/20 rounded px-2.5 py-1.5 max-h-20 overflow-y-auto">{selected.schema_json}</pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>{/* end scrollable area */}
          </div>
        )}
      </div>
    </div>
  );
}
