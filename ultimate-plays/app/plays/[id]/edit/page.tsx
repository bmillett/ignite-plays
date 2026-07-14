import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import NavBar from "@/components/NavBar";
import PlayEditor, { InitialPlay } from "@/components/PlayEditor";

export const metadata = { title: "Edit Play" };

interface EditPlayPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPlayPage({ params }: EditPlayPageProps) {
  const { id } = await params;

  // Forward the session cookie so the API route can authenticate
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/plays/${id}`,
    {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    notFound();
  }

  const play = (await res.json()) as InitialPlay & {
    createdByEmail: string;
    updatedAt: string;
  };

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
