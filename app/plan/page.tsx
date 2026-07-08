"use client";

import { useState, useRef } from "react";
import { Upload, Loader2, CheckCircle2, XCircle, ExternalLink, ChevronDown } from "lucide-react";
import clsx from "clsx";
import { PLAN_DATA, type PlanBlog } from "@/lib/plan-data";

type BlogStatus =
  | { type: "pending" }
  | { type: "generating" }
  | { type: "done"; blogId: number }
  | { type: "error"; message: string };

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

export default function PlanPage() {
  const [brand, setBrand] = useState("gas_o_fast");
  const [targetLength, setTargetLength] = useState("1200");
  const [statuses, setStatuses] = useState<Record<string, BlogStatus>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [customBlogs, setCustomBlogs] = useState<PlanBlog[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use custom uploaded plan if available, otherwise built-in data
  const blogs: PlanBlog[] = customBlogs ?? PLAN_DATA[brand] ?? [];

  // Reset statuses when brand changes (only if using built-in data)
  function handleBrandChange(newBrand: string) {
    setBrand(newBrand);
    if (!customBlogs) setStatuses({});
  }

  function statusKey(index: number) {
    return `${brand}-${index}`;
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
    }
    setUploading(false);
  }

  async function generateBlog(index: number) {
    const blog = blogs[index];
    const key = statusKey(index);
    setStatuses((prev) => ({ ...prev, [key]: { type: "generating" } }));

    const keywords = [blog.primary_keyword, ...blog.secondary_keywords.split(",").map((k) => k.trim())]
      .filter(Boolean)
      .slice(0, 6);

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
    if (!res.ok || data.error) {
      setStatuses((prev) => ({ ...prev, [key]: { type: "error", message: data.error ?? "Generation failed" } }));
    } else {
      setStatuses((prev) => ({ ...prev, [key]: { type: "done", blogId: data.id } }));
    }
  }

  const doneCount = Object.values(statuses).filter((s) => s.type === "done").length;
  const errorCount = Object.values(statuses).filter((s) => s.type === "error").length;
  const isGenerating = Object.values(statuses).some((s) => s.type === "generating");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-semibold text-white tracking-tight">Blog Plan</h1>
        <p className="text-sm text-zinc-400 mt-1">Select a brand to see its full content plan. Click Generate on any topic to produce the blog.</p>
      </div>

      {/* Controls */}
      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Brand</label>
          <div className="relative">
            <select
              value={brand}
              onChange={(e) => handleBrandChange(e.target.value)}
              className="appearance-none bg-zinc-900/60 border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-gold-400/50 pr-8 min-w-[160px]"
            >
              {BRANDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Blog Length</label>
          <div className="relative">
            <select
              value={targetLength}
              onChange={(e) => setTargetLength(e.target.value)}
              className="appearance-none bg-zinc-900/60 border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-gold-400/50 pr-8 min-w-[140px]"
            >
              {WORD_COUNTS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Stats */}
        {blogs.length > 0 && (
          <div className="flex items-center gap-5 pb-0.5 ml-2">
            <div className="text-center">
              <p className="text-lg font-semibold text-white leading-none">{blogs.length}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Total</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-green-400 leading-none">{doneCount}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Done</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-zinc-400 leading-none">{blogs.length - doneCount - errorCount}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Pending</p>
            </div>
            {errorCount > 0 && (
              <div className="text-center">
                <p className="text-lg font-semibold text-red-400 leading-none">{errorCount}</p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Errors</p>
              </div>
            )}
          </div>
        )}

        {/* Custom plan upload — secondary action */}
        <div className="ml-auto">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 border border-white/[0.06] hover:border-white/10 bg-zinc-900/40 rounded-xl px-3.5 py-2.5 transition-all"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {customBlogs ? "Replace custom plan" : "Import custom plan"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); }}
          />
        </div>
      </div>

      {uploadError && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{uploadError}</p>
      )}
      {customBlogs && (
        <div className="flex items-center gap-2 text-xs text-gold-400/80">
          <span>Showing custom uploaded plan ({customBlogs.length} blogs)</span>
          <button onClick={() => { setCustomBlogs(null); setStatuses({}); }} className="underline hover:text-gold-300">
            Back to built-in plan
          </button>
        </div>
      )}

      {/* Blog table */}
      <div className="bg-zinc-900/50 border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-5 py-3 text-[11px] uppercase tracking-wider text-zinc-500 font-medium w-24">Month</th>
                <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-zinc-500 font-medium w-36">Cluster</th>
                <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Blog Title</th>
                <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-zinc-500 font-medium w-44">Primary Keyword</th>
                <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-zinc-500 font-medium w-16">CTA</th>
                <th className="text-right px-5 py-3 text-[11px] uppercase tracking-wider text-zinc-500 font-medium w-36">Action</th>
              </tr>
            </thead>
            <tbody>
              {blogs.map((blog, i) => {
                const key = statusKey(i);
                const status = statuses[key] ?? { type: "pending" };
                return (
                  <tr
                    key={i}
                    className={clsx(
                      "border-b border-white/[0.04] last:border-0 transition-colors",
                      status.type === "done" && "bg-green-500/[0.03]",
                      status.type === "error" && "bg-red-500/[0.03]",
                      status.type === "generating" && "bg-gold-400/[0.03]"
                    )}
                  >
                    <td className="px-5 py-3.5 text-xs text-zinc-500 whitespace-nowrap">{blog.month}</td>
                    <td className="px-4 py-3.5">
                      <span className="text-[11px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-md border border-white/[0.05]">
                        {blog.cluster}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-white font-medium text-sm leading-snug">{blog.blog_title}</p>
                      <span className="text-[10px] text-zinc-600 uppercase tracking-wider">{blog.content_type}</span>
                      {status.type === "error" && (
                        <p className="text-xs text-red-400 mt-0.5 leading-snug">{status.message}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-zinc-400 leading-snug">
                      {blog.primary_keyword.split(",")[0]}
                    </td>
                    <td className="px-4 py-3.5">
                      {blog.cta_link ? (
                        <a
                          href={blog.cta_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-gold-400/70 hover:text-gold-400 flex items-center gap-1 transition-colors"
                        >
                          Link <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : (
                        <span className="text-[11px] text-zinc-700">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {status.type === "pending" && (
                        <button
                          onClick={() => generateBlog(i)}
                          disabled={isGenerating}
                          className="text-xs bg-gold-400/10 hover:bg-gold-400/20 text-gold-300 border border-gold-400/20 px-3 py-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Generate
                        </button>
                      )}
                      {status.type === "generating" && (
                        <span className="flex items-center justify-end gap-1.5 text-xs text-gold-400">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Generating…
                        </span>
                      )}
                      {status.type === "done" && (
                        <a
                          href="/blogs"
                          className="flex items-center justify-end gap-1.5 text-xs text-green-400 hover:text-green-300 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          View blog
                        </a>
                      )}
                      {status.type === "error" && (
                        <button
                          onClick={() => generateBlog(i)}
                          disabled={isGenerating}
                          className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors ml-auto disabled:opacity-40"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
