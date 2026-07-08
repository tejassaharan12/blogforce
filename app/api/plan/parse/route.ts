import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export interface PlanBlog {
  month: string;
  cluster: string;
  content_type: string;
  blog_title: string;
  primary_keyword: string;
  secondary_keywords: string;
  lsi_keywords: string;
  content_angle: string;
  cta_link: string;
}

// Maps plan content types to BlogForce generate API content_type values
function mapContentType(planType: string): string {
  const t = planType.toLowerCase();
  if (t.includes("faq") || t.includes("bofu")) return "faq";
  if (t.includes("pillar") || t.includes("comparison") || t.includes("guide")) return "guide";
  return "blog";
}

// Normalise multiline keyword cells — Google Sheets wraps multiple keywords across lines
function cleanKeywords(raw: string): string {
  return raw
    .split(/[\n\r]+/)
    .map((k) => k.trim())
    .filter(Boolean)
    .join(", ");
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const isXlsx = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");

    const workbook = XLSX.read(buffer, { type: "buffer" });

    // Find the sheet with blog plan data (has "Blog Title" in header row)
    let targetSheet = workbook.SheetNames[0];
    for (const name of workbook.SheetNames) {
      const ws = workbook.Sheets[name];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];
      const headers = rows[0] ?? [];
      if (headers.some((h) => typeof h === "string" && h.includes("Blog Title"))) {
        targetSheet = name;
        break;
      }
    }

    const ws = workbook.Sheets[targetSheet];
    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as string[][];

    const blogs: PlanBlog[] = [];

    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      const blogTitle = row[3];

      // Skip empty rows — accept all content types (Blog, Pillar, FAQ, Informational, etc.)
      if (!blogTitle || String(blogTitle).trim() === "") continue;

      // Row number in spreadsheet (1-based), accounting for header row
      const sheetRowNum = i + 1;
      const ctaCellRef = `H${sheetRowNum}`;
      let ctaLink = "";

      if (isXlsx) {
        // SheetJS stores hyperlinks in cell.l.Target for xlsx files
        const cell = ws[ctaCellRef] as XLSX.CellObject & { l?: { Target: string } };
        ctaLink = cell?.l?.Target?.replace(/&amp;/g, "&") ?? "";
        // Strip UTM/tracking params
        if (ctaLink.includes("?")) ctaLink = ctaLink.split("?")[0];
      }

      const rawContentType = String(row[2] ?? "blog");

      blogs.push({
        month: String(row[0] ?? ""),
        cluster: String(row[1] ?? ""),
        content_type: mapContentType(rawContentType),
        blog_title: String(blogTitle).replace(/[\n\r]+/g, " ").trim(),
        primary_keyword: cleanKeywords(String(row[4] ?? "")),
        secondary_keywords: cleanKeywords(String(row[5] ?? "")),
        lsi_keywords: cleanKeywords(String(row[6] ?? "")),
        content_angle: String(row[7] ?? "").replace(/[\n\r]+/g, " ").trim(),
        cta_link: ctaLink,
      });
    }

    return NextResponse.json({ blogs, sheet: targetSheet, total: blogs.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
