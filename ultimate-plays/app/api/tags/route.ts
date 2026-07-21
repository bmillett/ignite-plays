import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tags, playTags } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "@/lib/auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const rows = await db
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .orderBy(tags.name);
  return NextResponse.json(rows);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await req.json();

  if (!id || typeof id !== "number") {
    return NextResponse.json({ error: "Tag id is required" }, { status: 400 });
  }

  // play_tags has ON DELETE CASCADE, but delete explicitly to be safe
  await db.delete(playTags).where(eq(playTags.tagId, id));
  await db.delete(tags).where(eq(tags.id, id));

  return NextResponse.json({ ok: true });
}
