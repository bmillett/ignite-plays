import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tags } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const rows = await db.select({ id: tags.id, name: tags.name }).from(tags).orderBy(tags.name);
  return NextResponse.json(rows);
}
