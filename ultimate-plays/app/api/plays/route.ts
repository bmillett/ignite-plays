import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { plays, playSteps, playTags, tags } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import type { StepPositions } from "@/components/FieldCanvas";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const rows = await db
    .select({
      id: plays.id,
      name: plays.name,
      description: plays.description,
      createdByEmail: plays.createdByEmail,
      updatedAt: plays.updatedAt,
      tagName: tags.name,
    })
    .from(plays)
    .leftJoin(playTags, eq(playTags.playId, plays.id))
    .leftJoin(tags, eq(tags.id, playTags.tagId))
    .orderBy(plays.updatedAt);

  // Collapse multiple tag rows per play into a single entry with tags[]
  const map = new Map<number, { id: number; name: string; description: string | null; createdByEmail: string; updatedAt: Date; tags: string[] }>();
  for (const row of rows) {
    if (!map.has(row.id)) {
      map.set(row.id, { id: row.id, name: row.name, description: row.description, createdByEmail: row.createdByEmail, updatedAt: row.updatedAt, tags: [] });
    }
    if (row.tagName) map.get(row.id)!.tags.push(row.tagName);
  }

  return NextResponse.json([...map.values()]);
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json() as {
    name: string;
    description?: string;
    tags: string[];
    steps: StepPositions[];
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Insert play
  const [play] = await db
    .insert(plays)
    .values({
      name: body.name.trim(),
      description: body.description?.trim() || null,
      createdByEmail: auth.email,
    })
    .returning({ id: plays.id });

  // Insert steps
  if (body.steps.length > 0) {
    await db.insert(playSteps).values(
      body.steps.map((positions, stepIndex) => ({
        playId: play.id,
        stepIndex,
        positions,
      }))
    );
  }

  // Upsert tags and insert play_tags
  if (body.tags.length > 0) {
    for (const tagName of body.tags) {
      const trimmed = tagName.trim();
      if (!trimmed) continue;
      // Upsert tag by name
      const existing = await db
        .select({ id: tags.id })
        .from(tags)
        .where(eq(tags.name, trimmed));
      const tagId =
        existing.length > 0
          ? existing[0].id
          : (await db.insert(tags).values({ name: trimmed }).returning({ id: tags.id }))[0].id;
      await db
        .insert(playTags)
        .values({ playId: play.id, tagId })
        .onConflictDoNothing();
    }
  }

  return NextResponse.json({ id: play.id }, { status: 201 });
}
