"use client";

import { useEffect, useState } from "react";
import { IndianRupee, FileText, ShieldCheck, AlertTriangle } from "lucide-react";

interface Stats {
  total_blogs: number;
  total_cost: number;
  total_tokens: number;
  avg_risk_score: number;
  avg_plagiarism: number;
  compliant_blogs: number;
  approved_blogs: number;
}

interface BrandRow {
  brand: string;
  blogs_count: number;
  total_cost: number;
  avg_cost: number;
  compliant_count: number;
}

interface MonthlyRow {
  month: string;
  blogs_count: number;
  total_cost: number;
  total_tokens: number;
}

const MONTHLY_BUDGET_INR = 3000;

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [byBrand, setByBrand] = useState<BrandRow[]>([]);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((d) => {
        setStats(d.stats);
        setMonthly(d.monthly);
        setByBrand(d.byBrand ?? []);
      });
  }, []);

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-600">
        Loading analytics…
      </div>
    );
  }

  const complianceRate =
    stats.total_blogs > 0
      ? ((stats.compliant_blogs / stats.total_blogs) * 100).toFixed(1)
      : "100.0";

  const budgetUsed = monthly[0]?.total_cost ?? 0;
  const budgetPct = Math.min((budgetUsed / MONTHLY_BUDGET_INR) * 100, 100);

  return (
    <div className="animate-fade-up">
      <p className="text-[11px] uppercase tracking-[0.25em] text-gold-400/80 mb-2">
        Insights
      </p>
      <h1 className="text-4xl font-display font-semibold text-white tracking-tight mb-2">
        Analytics
      </h1>
      <p className="text-zinc-500 text-sm mb-10">Cost tracking, compliance overview, and monthly usage</p>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Blogs", value: stats.total_blogs, icon: FileText, color: "text-gold-400", bg: "bg-gold-400/10 border-gold-400/20" },
          { label: "Total Cost", value: `₹${(stats.total_cost ?? 0).toFixed(2)}`, icon: IndianRupee, color: "text-sky-400", bg: "bg-sky-400/10 border-sky-400/20" },
          { label: "Compliance Rate", value: `${complianceRate}%`, icon: ShieldCheck, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" },
          { label: "Avg Plagiarism", value: `${(stats.avg_plagiarism ?? 0).toFixed(1)}%`, icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20" },
        ].map((c) => (
          <div key={c.label} className="card-glass p-6 hover:border-white/[0.14] transition-colors duration-300">
            <div className={`${c.bg} w-11 h-11 rounded-xl border flex items-center justify-center mb-4`}>
              <c.icon className={`w-5 h-5 ${c.color}`} />
            </div>
            <p className="text-3xl font-display font-semibold text-white tracking-tight tabular-nums">{c.value}</p>
            <p className="text-xs uppercase tracking-wider text-zinc-500 mt-1.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Savings Banner */}
      {stats.total_blogs > 0 && (() => {
        const freelancerEstimate = stats.total_blogs * 3500;
        const totalSaved = freelancerEstimate - (stats.total_cost ?? 0);
        const savingsPct = Math.round((totalSaved / freelancerEstimate) * 100);
        return (
          <div className="card-glass !border-gold-400/20 p-6 mb-8 bg-gradient-to-r from-gold-400/[0.05] to-transparent flex items-center justify-between flex-wrap gap-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-400/70 mb-1">Total Value Generated</p>
              <p className="text-4xl font-display font-semibold text-gold-300 tabular-nums">
                ₹{totalSaved.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-zinc-500 mt-1.5">
                saved vs hiring freelance writers (avg ₹3,500/blog)
              </p>
            </div>
            <div className="flex gap-8">
              <div className="text-center">
                <p className="text-2xl font-display font-semibold text-zinc-100 tabular-nums">{stats.total_blogs}</p>
                <p className="text-[10px] uppercase tracking-wider text-zinc-600 mt-0.5">Blogs generated</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-display font-semibold text-zinc-100 tabular-nums">
                  ₹{(stats.total_cost ?? 0).toFixed(0)}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-zinc-600 mt-0.5">Total AI cost</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-display font-semibold text-emerald-300 tabular-nums">{savingsPct}%</p>
                <p className="text-[10px] uppercase tracking-wider text-zinc-600 mt-0.5">Cost reduction</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-display font-semibold text-zinc-100 tabular-nums">~{stats.total_blogs * 3}h</p>
                <p className="text-[10px] uppercase tracking-wider text-zinc-600 mt-0.5">Hours saved</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Monthly Budget Tracker */}
      <div className="card-glass p-7 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-white text-lg">This Month&apos;s Budget</h2>
          <span className="text-sm text-zinc-400 font-mono">
            ₹{budgetUsed.toFixed(2)} <span className="text-zinc-600">/ ₹{MONTHLY_BUDGET_INR}</span>
          </span>
        </div>
        <div className="w-full bg-white/[0.05] rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-2.5 rounded-full transition-all duration-700 ${budgetPct > 80 ? "bg-gradient-to-r from-rose-500 to-rose-400" : budgetPct > 50 ? "bg-gradient-to-r from-amber-500 to-amber-400" : "bg-gradient-to-r from-gold-500 to-gold-400"}`}
            style={{ width: `${budgetPct}%` }}
          />
        </div>
        <p className="text-xs text-zinc-500 mt-3">
          {budgetPct < 80
            ? `${(100 - budgetPct).toFixed(0)}% of monthly budget remaining`
            : "⚠️ Approaching budget limit — review usage"}
        </p>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="card-glass overflow-hidden mb-6">
        <div className="px-7 py-5 border-b border-white/[0.06]">
          <h2 className="font-display font-semibold text-white text-lg">Monthly Breakdown</h2>
        </div>
        {monthly.length === 0 ? (
          <div className="px-7 py-12 text-center text-zinc-600 text-sm">No data yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-[10px] text-zinc-600 uppercase tracking-wider">
              <tr className="border-b border-white/[0.06]">
                <th className="px-7 py-3.5 text-left font-medium">Month</th>
                <th className="px-7 py-3.5 text-left font-medium">Blogs</th>
                <th className="px-7 py-3.5 text-left font-medium">Tokens Used</th>
                <th className="px-7 py-3.5 text-left font-medium">Cost (INR)</th>
                <th className="px-7 py-3.5 text-left font-medium">Avg Cost/Blog</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {monthly.map((row) => (
                <tr key={row.month} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-7 py-3.5 font-medium text-zinc-100">{row.month}</td>
                  <td className="px-7 py-3.5 text-zinc-400 tabular-nums">{row.blogs_count}</td>
                  <td className="px-7 py-3.5 text-zinc-400 tabular-nums font-mono">{row.total_tokens?.toLocaleString()}</td>
                  <td className="px-7 py-3.5 text-gold-300 tabular-nums font-mono">₹{(row.total_cost ?? 0).toFixed(3)}</td>
                  <td className="px-7 py-3.5 text-zinc-400 tabular-nums font-mono">
                    ₹{row.blogs_count > 0 ? ((row.total_cost ?? 0) / row.blogs_count).toFixed(3) : "0"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Brand Breakdown */}
      {byBrand.length > 0 && (
        <div className="card-glass overflow-hidden mb-6">
          <div className="px-7 py-5 border-b border-white/[0.06]">
            <h2 className="font-display font-semibold text-white text-lg">Cost by Brand</h2>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {byBrand.map((row) => {
              const compliancePct = row.blogs_count > 0 ? Math.round((row.compliant_count / row.blogs_count) * 100) : 100;
              const BRAND_LABELS: Record<string, string> = {
                nimulid: "Nimulid Strong",
                gas_o_fast: "Gas-O-Fast Asli Jeera",
                healthok: "HealthOK Multivitamin",
              };
              const BRAND_COLORS: Record<string, string> = {
                nimulid: "bg-sky-400/10 text-sky-300 border-sky-400/20",
                gas_o_fast: "bg-orange-400/10 text-orange-300 border-orange-400/20",
                healthok: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
              };
              return (
                <div key={row.brand} className="px-7 py-4 flex items-center gap-6 hover:bg-white/[0.02] transition-colors">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium flex-shrink-0 ${BRAND_COLORS[row.brand] ?? "bg-white/[0.06] text-zinc-400 border-white/10"}`}>
                    {BRAND_LABELS[row.brand] ?? row.brand}
                  </span>
                  <div className="flex-1 grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-zinc-100 font-semibold tabular-nums">{row.blogs_count}</p>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Blogs</p>
                    </div>
                    <div>
                      <p className="text-gold-300 font-semibold font-mono tabular-nums">₹{(row.total_cost ?? 0).toFixed(2)}</p>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Total cost</p>
                    </div>
                    <div>
                      <p className="text-zinc-100 font-semibold font-mono tabular-nums">₹{(row.avg_cost ?? 0).toFixed(2)}</p>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Avg / blog</p>
                    </div>
                    <div>
                      <p className={`font-semibold tabular-nums ${compliancePct === 100 ? "text-emerald-300" : compliancePct >= 70 ? "text-amber-300" : "text-rose-300"}`}>{compliancePct}%</p>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Compliance</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Token info */}
      <div className="card-glass !border-gold-400/20 p-6 text-sm">
        <p className="font-display font-semibold text-gold-300 mb-3">Claude Opus 4.8 Pricing (2-Pass Generation)</p>
        <ul className="space-y-1.5 text-xs text-zinc-400">
          <li>• Model: claude-opus-4-8 (best quality)</li>
          <li>• Input tokens: ₹1,275 per million tokens (~$15/MTok)</li>
          <li>• Output tokens: ₹6,375 per million tokens (~$75/MTok)</li>
          <li>• Pass 1 (generation): ~₹12–15 per blog</li>
          <li>• Pass 2 (humanisation): ~₹12–15 per blog</li>
          <li>• Average blog total: ₹25–35 per blog</li>
          <li>• 15 blogs/month estimate: ₹375–525</li>
          <li>• Monthly budget cap: ₹3,000 (generation stops if exceeded)</li>
          <li>• Total tokens used all time: {(stats.total_tokens ?? 0).toLocaleString()}</li>
        </ul>
      </div>

      <div className="card-glass !border-amber-400/20 p-6 text-sm mt-4">
        <p className="font-display font-semibold text-amber-300 mb-3">⚠️ Regeneration Cost Warning</p>
        <ul className="space-y-1.5 text-xs text-zinc-400">
          <li>• Every regeneration = full cost again (₹25–35)</li>
          <li>• 1 regeneration on 1 blog = ₹50–70 for that blog</li>
          <li>• Avoid unnecessary regenerations — edit the content manually instead</li>
          <li>• Use the Brand Voice Hint field to reduce need for regenerations</li>
          <li>• Budget cap of ₹3,000/month will stop generation if exceeded</li>
        </ul>
      </div>
    </div>
  );
}
