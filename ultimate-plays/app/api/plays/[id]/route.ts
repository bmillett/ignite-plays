import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { plays, playSteps, playTags, tags } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import type { StepPositions } from "@/components/FieldCanvas";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const playId = parseInt(id, 10);
  if (isNaN(playId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // Fetch play
  const [play] = await db.select().from(plays).where(eq(plays.id, playId));
  if (!play) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch steps ordered by step_index
  const stepRows = await db
    .select()
    .from(playSteps)
    .where(eq(playSteps.playId, playId))
    .orderBy(asc(playSteps.stepIndex));

  // Fetch tags
  const tagRows = await db
    .select({ name: tags.name })
    .from(playTags)
    .innerJoin(tags, eq(tags.id, playTags.tagId))
    .where(eq(playTags.playId, playId));

  return NextResponse.json({
    id: play.id,
    name: play.name,
    description: play.description,
    createdByEmail: play.createdByEmail,
    updatedAt: play.updatedAt,
    tags: tagRows.map((r) => r.name),
    steps: stepRows.map((r) => r.positions) as StepPositions[],
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const playId = parseInt(id, 10);
  if (isNaN(playId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json() as {
    name: string;
    description?: string;
    tags: string[];
    steps: StepPositions[];
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Update play metadata
  await db
    .update(plays)
    .set({
      name: body.name.trim(),
      description: body.description?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(plays.id, playId));

  // Replace steps
  await db.delete(playSteps).where(eq(playSteps.playId, playId));
  if (body.steps.length > 0) {
    await db.insert(playSteps).values(
      body.steps.map((positions, stepIndex) => ({
        playId,
        stepIndex,
        positions,
      }))
    );
  }

  // Replace play_tags
  await db.delete(playTags).where(eq(playTags.playId, playId));
  if (body.tags.length > 0) {
    for (const tagName of body.tags) {
      const trimmed = tagName.trim();
      if (!trimmed) continue;
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
        .values({ playId, tagId })
        .onConflictDoNothing();
    }
  }

  return NextResponse.json({ id: playId });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const playId = parseInt(id, 10);
  if (isNaN(playId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // play_steps and play_tags have ON DELETE CASCADE, but we delete explicitly
  // to be safe with any DB that might not enforce it.
  await db.delete(playTags).where(eq(playTags.playId, playId));
  await db.delete(playSteps).where(eq(playSteps.playId, playId));
  await db.delete(plays).where(eq(plays.id, playId));

  return NextResponse.json({ ok: true });
}
