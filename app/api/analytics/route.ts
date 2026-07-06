import { NextResponse } from "next/server";
import { blogsDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const [stats, monthly, byBrand] = await Promise.all([
    blogsDb.getStats(),
    blogsDb.getMonthlyUsage(),
    blogsDb.getBrandBreakdown(),
  ]);
  return NextResponse.json({ stats, monthly, byBrand });
}
