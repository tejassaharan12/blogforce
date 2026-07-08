import { NextResponse } from "next/server";
import { blogsDb } from "@/lib/db";
import { sendAlert } from "@/lib/email";

export const dynamic = "force-dynamic";

interface Check {
  ok: boolean;
  message: string;
  fix?: string;
}

export async function GET(req: Request) {
  const checks: Record<string, Check> = {};

  // ── 1. DATABASE ─────────────────────────────────────────────────────────────
  try {
    const stats = await blogsDb.getStats();
    checks.database = { ok: true, message: `Connected · ${stats.total_blogs ?? 0} blogs stored` };
  } catch (e) {
    checks.database = {
      ok: false,
      message: "Cannot reach Turso database",
      fix: "Check TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Vercel environment variables",
    };
  }

  // ── 2. ANTHROPIC ────────────────────────────────────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    checks.anthropic = {
      ok: false,
      message: "ANTHROPIC_API_KEY not set",
      fix: "Add ANTHROPIC_API_KEY to Vercel environment variables and redeploy",
    };
  } else {
    checks.anthropic = { ok: true, message: "API key configured" };
  }

  // ── 3. COPYSCAPE ────────────────────────────────────────────────────────────
  const csUser = process.env.COPYSCAPE_USERNAME;
  const csKey = process.env.COPYSCAPE_API_KEY;
  if (!csUser || !csKey) {
    checks.copyscape = {
      ok: false,
      message: "COPYSCAPE_USERNAME or COPYSCAPE_API_KEY not set",
      fix: "Add both to Vercel environment variables",
    };
  } else {
    checks.copyscape = {
      ok: true,
      message: `Credentials configured (user: ${csUser})`,
    };
  }

  // ── 4. DATAFORSEO ───────────────────────────────────────────────────────────
  const dfsLogin = process.env.DATAFORSEO_LOGIN;
  const dfsPass = process.env.DATAFORSEO_PASSWORD;
  if (!dfsLogin || !dfsPass) {
    checks.dataforseo = {
      ok: false,
      message: "DATAFORSEO_LOGIN or DATAFORSEO_PASSWORD not set",
      fix: "Add both to Vercel environment variables",
    };
  } else {
    try {
      const auth = "Basic " + Buffer.from(`${dfsLogin}:${dfsPass}`).toString("base64");
      const res = await fetch("https://api.dataforseo.com/v3/appendix/user_data", {
        headers: { Authorization: auth },
      });
      const data = await res.json();
      if (res.ok && data.status_code === 20000) {
        const balance = data.tasks?.[0]?.result?.[0]?.money?.balance ?? null;
        checks.dataforseo = {
          ok: true,
          message: balance !== null ? `Connected · $${parseFloat(balance).toFixed(2)} balance` : "Connected",
        };
      } else {
        checks.dataforseo = {
          ok: false,
          message: `Auth failed (${data.status_code ?? res.status})`,
          fix: "Check DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in Vercel environment variables",
        };
      }
    } catch {
      checks.dataforseo = {
        ok: false,
        message: "DataForSEO API unreachable",
        fix: "DataForSEO may be down. Check dataforseo.com",
      };
    }
  }

  // ── 5. SENTRY ───────────────────────────────────────────────────────────────
  checks.sentry = process.env.NEXT_PUBLIC_SENTRY_DSN
    ? { ok: true, message: "Error monitoring active" }
    : { ok: false, message: "NEXT_PUBLIC_SENTRY_DSN not set — app errors won't be tracked", fix: "Add NEXT_PUBLIC_SENTRY_DSN to Vercel environment variables" };

  // ── 6. RESEND ───────────────────────────────────────────────────────────────
  checks.resend = process.env.RESEND_API_KEY
    ? { ok: true, message: "Email alerts configured" }
    : { ok: false, message: "RESEND_API_KEY not set — error emails will not be sent", fix: "Add RESEND_API_KEY to Vercel environment variables" };

  // ── 6. STEALTHGPT ───────────────────────────────────────────────────────────
  if (!process.env.STEALTHGPT_API_KEY) {
    checks.stealthgpt = {
      ok: false,
      message: "STEALTHGPT_API_KEY not set",
      fix: "Add STEALTHGPT_API_KEY to Vercel environment variables and redeploy",
    };
  } else {
    checks.stealthgpt = { ok: true, message: "API key configured" };
  }

  // ── 6. BUDGET ───────────────────────────────────────────────────────────────
  try {
    const monthly = await blogsDb.getMonthlyUsage();
    const currentMonth = new Date().toISOString().slice(0, 7);
    const thisMonth = monthly.find((m) => m.month === currentMonth);
    const spend = thisMonth?.total_cost ?? 0;
    const cap = 3000;
    const pct = Math.round((spend / cap) * 100);
    if (spend >= cap) {
      checks.budget = {
        ok: false,
        message: `Monthly budget cap reached: ₹${spend.toFixed(0)} / ₹${cap}`,
        fix: "No more blogs can be generated this month. Wait for next month or increase the cap in lib/generate.ts",
      };
    } else if (pct >= 80) {
      checks.budget = {
        ok: false,
        message: `Budget at ${pct}%: ₹${spend.toFixed(0)} / ₹${cap} — only ₹${(cap - spend).toFixed(0)} left`,
        fix: "You are close to the monthly limit. Use remaining budget carefully.",
      };
    } else {
      checks.budget = { ok: true, message: `₹${spend.toFixed(0)} / ₹${cap} used (${pct}%)` };
    }
  } catch {
    checks.budget = { ok: true, message: "Could not read budget data" };
  }

  const allOk = Object.values(checks).every((c) => c.ok);
  const issues = Object.entries(checks).filter(([, c]) => !c.ok);

  // Send email alert when called by UptimeRobot and something is broken
  if (!allOk && req.headers.get("user-agent")?.toLowerCase().includes("uptimerobot")) {
    const details = issues.map(([k, c]) => `${k}: ${c.message}${c.fix ? `\nFix: ${c.fix}` : ""}`).join("\n\n");
    await sendAlert({
      type: "service_down",
      title: `${issues.length} service${issues.length > 1 ? "s" : ""} down: ${issues.map(([k]) => k).join(", ")}`,
      details,
    });
  }

  return NextResponse.json(
    {
      ok: allOk,
      checked_at: new Date().toISOString(),
      summary: allOk
        ? "All systems operational"
        : `${issues.length} issue${issues.length > 1 ? "s" : ""} detected: ${issues.map(([k]) => k).join(", ")}`,
      checks,
    },
    { status: allOk ? 200 : 503 }
  );
}
