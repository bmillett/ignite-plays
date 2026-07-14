"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import PlayCard, { Play } from "@/components/PlayCard";

interface Tag {
  id: number;
  name: string;
}

export default function HomePage() {
  const [plays, setPlays] = useState<Play[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/plays").then((r) => r.json()),
      fetch("/api/tags").then((r) => r.json()),
    ]).then(([playsData, tagsData]) => {
      setPlays(playsData);
      setTags(tagsData);
      setLoading(false);
    });
  }, []);

  function toggleTag(name: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function handleDeleted(id: number) {
    setPlays((prev) => prev.filter((p) => p.id !== id));
  }

  const filtered =
    selectedTags.size === 0
      ? plays
      : plays.filter((p) => p.tags.some((t) => selectedTags.has(t)));

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <NavBar />

      <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Play Library</h1>
          <Link
            href="/plays/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            + New Play
          </Link>
        </div>

        {/* Tag filter bar */}
        {tags.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {tags.map((tag) => {
              const active = selectedTags.has(tag.name);
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.name)}
                  className={`rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-gray-300 bg-white text-gray-600 hover:border-blue-400 hover:text-blue-600"
                  }`}
                >
                  {tag.name}
                </button>
              );
            })}
            {selectedTags.size > 0 && (
              <button
                onClick={() => setSelectedTags(new Set())}
                className="rounded-full border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-500 hover:bg-gray-200 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <p className="text-sm text-gray-500">Loading plays…</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-20 text-center">
            <p className="text-gray-500 text-base">
              {plays.length === 0
                ? "No plays yet. Create your first play!"
                : "No plays match the selected tags."}
            </p>
            {plays.length === 0 && (
              <Link
                href="/plays/new"
                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                Create your first play
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((play) => (
              <PlayCard key={play.id} play={play} onDeleted={handleDeleted} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
