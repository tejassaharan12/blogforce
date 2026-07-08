import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export interface PlanBlog {
  month: string;
  cluster: string;
  blog_title: string;
  primary_keyword: string;
  secondary_keywords: string;
  lsi_keywords: string;
  content_angle: string;
  cta_link: string;
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
      const contentType = row[2];

      if (!blogTitle || (contentType && contentType.toString().toLowerCase() !== "blog")) continue;

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

      blogs.push({
        month: String(row[0] ?? ""),
        cluster: String(row[1] ?? ""),
        blog_title: String(blogTitle),
        primary_keyword: String(row[4] ?? ""),
        secondary_keywords: String(row[5] ?? ""),
        lsi_keywords: String(row[6] ?? ""),
        content_angle: String(row[7] ?? ""),
        cta_link: ctaLink,
      });
    }

    return NextResponse.json({ blogs, sheet: targetSheet, total: blogs.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
