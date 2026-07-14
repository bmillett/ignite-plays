import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import AnimationPlayer from "@/components/AnimationPlayer";
import type { StepPositions } from "@/components/FieldCanvas";

export const metadata = { title: "View Play" };

interface ViewPlayPageProps {
  params: Promise<{ id: string }>;
}

interface PlayData {
  id: number;
  name: string;
  description: string | null;
  createdByEmail: string;
  updatedAt: string;
  tags: string[];
  steps: StepPositions[];
}

export default async function ViewPlayPage({ params }: ViewPlayPageProps) {
  const { id } = await params;

  // Forward the session cookie so the API route can authenticate
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
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

  const play = (await res.json()) as PlayData;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <NavBar />

      <main className="mx-auto w-full max-w-4xl px-6 py-8 flex-1">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{play.name}</h1>

            {play.description && (
              <p className="mt-1 text-sm text-gray-500">{play.description}</p>
            )}

            {play.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {play.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-medium text-blue-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <Link
            href={`/plays/${play.id}/edit`}
            className="shrink-0 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Edit Play
          </Link>
        </div>

        {/* Animation player */}
        {play.steps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white py-20 text-center">
            <p className="text-sm text-gray-500">This play has no steps yet.</p>
            <Link
              href={`/plays/${play.id}/edit`}
              className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Add Steps
            </Link>
          </div>
        ) : (
          <AnimationPlayer
            steps={play.steps}
            playName={play.name}
            playId={play.id}
            tags={play.tags}
          />
        )}
      </main>
    </div>
  );
}
