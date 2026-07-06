import { NextResponse } from "next/server";

interface TestResult {
  connected: boolean;
  detail: string;
}

export async function GET() {
  const results: Record<string, TestResult> = {};

  // ── ANTHROPIC (Claude API) ───────────────────────────────────────────────
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    results.claude = { connected: false, detail: "Missing ANTHROPIC_API_KEY in .env.local" };
  } else {
    try {
      const res = await fetch("https://api.anthropic.com/v1/models", {
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
      });
      results.claude = res.ok
        ? { connected: true, detail: "Connected ✅ — API key valid" }
        : { connected: false, detail: `Auth failed (status ${res.status}) — check your API key` };
    } catch {
      results.claude = { connected: false, detail: "Network error reaching Anthropic API" };
    }
  }

  // ── COPYSCAPE ────────────────────────────────────────────────────────────
  const csUser = process.env.COPYSCAPE_USERNAME;
  const csKey = process.env.COPYSCAPE_API_KEY;

  if (!csUser || !csKey) {
    results.copyscape = {
      connected: false,
      detail: "Missing COPYSCAPE_USERNAME or COPYSCAPE_API_KEY in .env.local",
    };
  } else {
    try {
      const res = await fetch(
        `https://www.copyscape.com/api/?u=${encodeURIComponent(csUser)}&k=${encodeURIComponent(csKey)}&o=balance&f=json`
      );
      const data = await res.json();
      if (data.value !== undefined) {
        const balance = parseFloat(data.value);
        const hasCredits = balance > 0;
        results.copyscape = {
          connected: true,
          detail: hasCredits
            ? `Connected ✅ — Balance: $${balance.toFixed(2)} (~${Math.floor(balance / 0.03)} checks remaining)`
            : `Connected ✅ — But balance is $0.00. Add credits at copyscape.com to enable real checks.`,
        };
      } else {
        results.copyscape = {
          connected: false,
          detail: `Auth failed — wrong username or password. Response: ${JSON.stringify(data)}`,
        };
      }
    } catch {
      results.copyscape = { connected: false, detail: "Network error reaching Copyscape API" };
    }
  }

  // ── DATAFORSEO (not yet integrated) ─────────────────────────────────────
  const dfsLogin = process.env.DATAFORSEO_LOGIN;
  const dfsPass = process.env.DATAFORSEO_PASSWORD;

  if (!dfsLogin || !dfsPass) {
    results.dataforseo = {
      connected: false,
      detail: "Not configured — add DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD to .env.local",
    };
  } else {
    try {
      const credentials = Buffer.from(`${dfsLogin}:${dfsPass}`).toString("base64");
      const res = await fetch("https://api.dataforseo.com/v3/appendix/user_data", {
        headers: { Authorization: `Basic ${credentials}` },
      });
      const data = await res.json();
      results.dataforseo = res.ok
        ? { connected: true, detail: `Connected ✅ — Account: ${data?.tasks?.[0]?.result?.[0]?.login ?? dfsLogin}` }
        : { connected: false, detail: `Auth failed (status ${res.status})` };
    } catch {
      results.dataforseo = { connected: false, detail: "Network error reaching DataForSEO API" };
    }
  }

  const allConnected = Object.values(results).every((r) => r.connected);

  return NextResponse.json({
    status: allConnected ? "all_connected" : "some_missing",
    results,
  });
}
