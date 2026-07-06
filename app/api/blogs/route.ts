import { NextRequest, NextResponse } from "next/server";
import { blogsDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const brand = searchParams.get("brand");

  const blogs = brand ? await blogsDb.getByBrand(brand) : await blogsDb.getAll();
  return NextResponse.json(blogs);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, status } = body;
  if (!id || !status) {
    return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
  }
  await blogsDb.updateStatus(Number(id), status);
  return NextResponse.json({ success: true });
}
