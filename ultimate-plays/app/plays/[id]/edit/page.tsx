import { notFound } from "next/navigation";
import NavBar from "@/components/NavBar";
import PlayEditor, { InitialPlay } from "@/components/PlayEditor";
import { getPlay } from "@/lib/getPlay";

export const metadata = { title: "Edit Play" }; // → "Edit Play — 🥏 Ignite Plays"

interface EditPlayPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPlayPage({ params }: EditPlayPageProps) {
  const { id } = await params;
  const playId = parseInt(id, 10);
  if (isNaN(playId)) notFound();

  const play = await getPlay(playId);
  if (!play) notFound();

  const initialPlay: InitialPlay = {
    id: play.id,
    name: play.name,
    description: play.description ?? "",
    tags: play.tags,
    steps: play.steps,
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <NavBar />
      <div className="flex-1 min-h-0">
        <PlayEditor initialPlay={initialPlay} />
      </div>
    </div>
  );
}
