import { db } from "@/lib/db";
import { plays, playSteps, playTags, tags } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import type { StepPositions } from "@/components/FieldCanvas";

export interface PlayData {
  id: number;
  name: string;
  description: string | null;
  createdByEmail: string;
  updatedAt: Date;
  tags: string[];
  steps: StepPositions[];
}

export async function getPlay(id: number): Promise<PlayData | null> {
  const [play] = await db.select().from(plays).where(eq(plays.id, id));
  if (!play) return null;

  const stepRows = await db
    .select()
    .from(playSteps)
    .where(eq(playSteps.playId, id))
    .orderBy(asc(playSteps.stepIndex));

  const tagRows = await db
    .select({ name: tags.name })
    .from(playTags)
    .innerJoin(tags, eq(tags.id, playTags.tagId))
    .where(eq(playTags.playId, id));

  return {
    id: play.id,
    name: play.name,
    description: play.description,
    createdByEmail: play.createdByEmail,
    updatedAt: play.updatedAt,
    tags: tagRows.map((r) => r.name),
    steps: stepRows.map((r) => r.positions) as StepPositions[],
  };
}
