import { blogsDb } from "@/lib/db";
import Link from "next/link";
import { PenLine, CheckCircle, AlertTriangle, IndianRupee } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [stats, all] = await Promise.all([blogsDb.getStats(), blogsDb.getAll()]);
  const recent = all.slice(0, 5);

  const complianceRate =
    stats.total_blogs > 0
      ? ((stats.compliant_blogs / stats.total_blogs) * 100).toFixed(0)
      : 100;

  const cards = [
    {
      label: "Total Blogs",
      value: stats.total_blogs ?? 0,
      icon: PenLine,
      color: "text-gold-400",
      bg: "bg-gold-400/10 border-gold-400/20",
    },
    {
      label: "Compliance Rate",
      value: `${complianceRate}%`,
      icon: CheckCircle,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10 border-emerald-400/20",
    },
    {
      label: "Avg Plagiarism",
      value: `${(stats.avg_plagiarism ?? 0).toFixed(1)}%`,
      icon: AlertTriangle,
      color: "text-amber-400",
      bg: "bg-amber-400/10 border-amber-400/20",
    },
    {
      label: "Total Cost",
      value: `₹${(stats.total_cost ?? 0).toFixed(2)}`,
      icon: IndianRupee,
      color: "text-sky-400",
      bg: "bg-sky-400/10 border-sky-400/20",
    },
  ];

  const brandColors: Record<string, string> = {
    nimulid: "bg-sky-400/10 text-sky-300 border border-sky-400/20",
    gas_o_fast: "bg-orange-400/10 text-orange-300 border border-orange-400/20",
    healthok: "bg-emerald-400/10 text-emerald-300 border border-emerald-400/20",
  };

  const statusColors: Record<string, string> = {
    draft: "bg-white/[0.06] text-zinc-400 border border-white/10",
    approved: "bg-emerald-400/10 text-emerald-300 border border-emerald-400/20",
    needs_review: "bg-rose-400/10 text-rose-300 border border-rose-400/20",
  };

  return (
    <div className="animate-fade-up">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-gold-400/80 mb-2">
            Overview
          </p>
          <h1 className="text-4xl font-display font-semibold text-white tracking-tight">
            Dashboard
          </h1>
          <p className="text-zinc-500 text-sm mt-2">
            Pharmaceutical blog generation overview
          </p>
        </div>
        <Link
          href="/generate"
          className="bg-gradient-to-b from-gold-400 to-gold-500 hover:from-gold-300 hover:to-gold-400 text-ink-950 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-glow-gold hover:shadow-lg"
        >
          + New Blog
        </Link>
      </div>

      {/* Attention banner */}
      {(() => {
        const needsReview = recent.filter((b) => !b.compliance_passed || b.status === "needs_review");
        if (needsReview.length === 0) return null;
        return (
          <Link href="/blogs" className="flex items-center gap-3 mb-6 bg-rose-500/[0.07] border border-rose-400/25 rounded-xl px-5 py-4 hover:bg-rose-500/[0.11] transition-colors group">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <p className="text-sm text-rose-300 flex-1">
              <span className="font-semibold">{needsReview.length} blog{needsReview.length > 1 ? "s" : ""} need your attention</span>
              <span className="text-rose-400/60"> — compliance issues detected. Review before publishing.</span>
            </p>
            <span className="text-xs text-rose-400 group-hover:text-rose-200 transition-colors">View →</span>
          </Link>
        );
      })()}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <div
            key={c.label}
            className="card-glass p-6 hover:border-white/[0.14] transition-colors duration-300"
          >
            <div
              className={`${c.bg} w-11 h-11 rounded-xl border flex items-center justify-center mb-4`}
            >
              <c.icon className={`w-5 h-5 ${c.color}`} />
            </div>
            <p className="text-3xl font-display font-semibold text-white tracking-tight tabular-nums">
              {c.value}
            </p>
            <p className="text-xs uppercase tracking-wider text-zinc-500 mt-1.5">
              {c.label}
            </p>
          </div>
        ))}
      </div>

      {/* Budget alert */}
      {(stats.total_cost ?? 0) > 400 && (
        <div className="bg-rose-500/[0.07] border border-rose-400/25 rounded-2xl p-5 mb-8 flex items-start gap-4">
          <div className="w-9 h-9 rounded-lg bg-rose-400/10 border border-rose-400/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <p className="font-semibold text-rose-300">Approaching Monthly Budget</p>
            <p className="text-sm text-rose-300/60 mt-0.5">
              You&apos;ve spent ₹{(stats.total_cost ?? 0).toFixed(2)} this month. Consider pausing generation.
            </p>
          </div>
        </div>
      )}

      {/* Recent Blogs */}
      <div className="card-glass overflow-hidden">
        <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="font-display font-semibold text-white text-lg">Recent Blogs</h2>
          <Link
            href="/blogs"
            className="text-gold-400 text-sm hover:text-gold-300 transition-colors"
          >
            View all →
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="px-6 py-16 text-center text-zinc-500">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
              <PenLine className="w-6 h-6 text-zinc-600" />
            </div>
            <p className="text-sm">No blogs generated yet.</p>
            <Link
              href="/generate"
              className="mt-3 inline-block text-gold-400 text-sm hover:text-gold-300 transition-colors"
            >
              Generate your first blog →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {recent.map((blog) => (
              <div
                key={blog.id}
                className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-100 truncate">{blog.topic}</p>
                  <p className="text-xs text-zinc-500 mt-1 font-mono">
                    {blog.word_count} words · ₹{blog.cost_inr.toFixed(4)} ·{" "}
                    {new Date(blog.created_at).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  <span
                    className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${brandColors[blog.brand] ?? "bg-white/[0.06] text-zinc-400 border border-white/10"}`}
                  >
                    {blog.brand.replace(/_/g, "-")}
                  </span>
                  <span
                    className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${statusColors[blog.status] ?? "bg-white/[0.06] text-zinc-400 border border-white/10"}`}
                  >
                    {blog.status.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
