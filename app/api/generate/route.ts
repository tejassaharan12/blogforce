import { NextRequest, NextResponse } from "next/server";
import { generateBlog } from "@/lib/generate";
import { blogsDb } from "@/lib/db";
import type { BrandKey } from "@/lib/compliance";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { brand, topic, keywords, target_audience, content_type, brand_voice_hint } = body;

    if (!brand || !topic || !keywords || !target_audience || !content_type) {
      return NextResponse.json(
        { error: "Missing required fields: brand, topic, keywords, target_audience, content_type" },
        { status: 400 }
      );
    }

    const keywordArr: string[] =
      typeof keywords === "string"
        ? keywords.split(",").map((k: string) => k.trim()).filter(Boolean)
        : keywords;

    // Duplicate guard — block same brand+topic within 2 minutes
    const recentBlogs = await blogsDb.getAll();
    const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const duplicate = recentBlogs.find(
      (b) => b.brand === brand &&
             b.topic.trim().toLowerCase() === topic.trim().toLowerCase() &&
             b.created_at > twoMinsAgo
    );
    if (duplicate) {
      return NextResponse.json(
        { error: `This blog was just generated (ID #${duplicate.id}). Check All Blogs to view it.` },
        { status: 409 }
      );
    }

    // Get current month's spend to enforce budget cap
    const monthly = await blogsDb.getMonthlyUsage();
    const currentMonth = new Date().toISOString().slice(0, 7);
    const thisMonthData = monthly.find((m) => m.month === currentMonth);
    const currentMonthlySpend = thisMonthData?.total_cost ?? 0;

    const result = await generateBlog(
      {
        brand: brand as BrandKey,
        topic,
        keywords: keywordArr,
        target_audience,
        content_type,
        brand_voice_hint,
      },
      currentMonthlySpend
    );

    // Save to database
    const id = await blogsDb.insert({
      brand,
      topic,
      keywords: keywordArr.join(", "),
      target_audience,
      content_type,
      content: result.content,
      status: result.compliance.passed ? "draft" : "needs_review",
      compliance_passed: result.compliance.passed ? 1 : 0,
      compliance_risk_score: result.compliance.risk_score,
      compliance_violations: JSON.stringify(result.compliance.violations),
      plagiarism_score: result.plagiarism.score,
      plagiarism_passed: result.plagiarism.passed ? 1 : 0,
      plagiarism_source: result.plagiarism.source,
      seo_keywords_found: result.seo.keywords_found.length,
      word_count: result.seo.word_count,
      tokens_used: result.tokens.total,
      cost_inr: result.cost_inr,
      meta_title: result.seo.meta_title,
      meta_description: result.seo.meta_description,
      url_slug: result.seo.url_slug ?? "",
      schema_json: result.seo.suggested_schema ?? "{}",
      keyword_data_json: JSON.stringify(result.keyword_data ?? []),
      human_score: result.human_score ?? 0,
    });

    return NextResponse.json({ id, ...result }, { status: 200 });
  } catch (err: unknown) {
    console.error("Generation error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";

    // Budget cap error — return 402 Payment Required so frontend can show specific message
    if (message.includes("budget cap") || message.includes("exceed your monthly budget")) {
      return NextResponse.json({ error: message, code: "BUDGET_EXCEEDED" }, { status: 402 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
