"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import clsx from "clsx";

interface Check {
  ok: boolean;
  message: string;
  fix?: string;
}

interface HealthData {
  ok: boolean;
  summary: string;
  checked_at: string;
  checks: Record<string, Check>;
}

const SERVICE_LABELS: Record<string, string> = {
  database: "Database",
  anthropic: "Claude AI",
  copyscape: "Copyscape",
  dataforseo: "DataForSEO",
  budget: "Monthly Budget",
};

export default function HealthBanner() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const check = () => {
    setLoading(true);
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { check(); }, []);

  if (loading) return null;
  if (!health) return null;
  if (health.ok) return null; // all good — show nothing

  const issues = Object.entries(health.checks).filter(([, c]) => !c.ok);

  return (
    <div className="mb-6 rounded-2xl border border-rose-400/30 bg-rose-500/[0.06] overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-rose-400/15">
        <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
        <p className="text-sm font-semibold text-rose-300 flex-1">
          {issues.length} System Issue{issues.length > 1 ? "s" : ""} Detected
        </p>
        <button
          onClick={check}
          className="flex items-center gap-1.5 text-[11px] text-rose-400/70 hover:text-rose-300 transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Recheck
        </button>
      </div>
      <div className="divide-y divide-rose-400/10">
        {issues.map(([key, check]) => (
          <div key={key} className="px-5 py-3">
            <div className="flex items-start gap-2.5">
              <span className={clsx(
                "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5",
                "bg-rose-400/10 text-rose-400"
              )}>
                {SERVICE_LABELS[key] ?? key}
              </span>
              <div>
                <p className="text-sm text-rose-200">{check.message}</p>
                {check.fix && (
                  <p className="text-xs text-rose-300/60 mt-0.5">
                    Fix: {check.fix}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
