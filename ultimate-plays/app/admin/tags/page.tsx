"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";

interface Tag {
  id: number;
  name: string;
}

export default function AdminTagsPage() {
  const router = useRouter();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function loadTags() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/tags");
      if (res.status === 401 || res.status === 403) {
        router.push("/");
        return;
      }
      if (!res.ok) throw new Error("Failed to load tags");
      setTags(await res.json());
    } catch {
      setError("Failed to load tags.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete(tag: Tag) {
    if (
      !confirm(
        `Delete tag "${tag.name}"? It will be removed from all plays that use it.`
      )
    )
      return;

    setDeletingId(tag.id);
    try {
      const res = await fetch("/api/tags", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tag.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Failed to delete tag");
        return;
      }
      await loadTags();
    } catch {
      alert("Something went wrong.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <NavBar />
      <div className="max-w-2xl mx-auto w-full p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Manage Tags</h1>
        <p className="text-sm text-gray-500 mb-8">
          Delete tags globally. Removing a tag will unlink it from all plays.
          Tags are created automatically when editors add them to a play.
        </p>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">
              All Tags ({tags.length})
            </h2>
          </div>

          {loading ? (
            <div className="px-6 py-8 text-sm text-gray-500 text-center">
              Loading…
            </div>
          ) : error ? (
            <div className="px-6 py-8 text-sm text-red-600 text-center">
              {error}
            </div>
          ) : tags.length === 0 ? (
            <div className="px-6 py-8 text-sm text-gray-500 text-center">
              No tags yet. Tags are created when editors save plays.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {tags.map((tag) => (
                <li
                  key={tag.id}
                  className="flex items-center justify-between px-6 py-3"
                >
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-sm text-blue-700 font-medium">
                    🏷 {tag.name}
                  </span>
                  <button
                    onClick={() => handleDelete(tag)}
                    disabled={deletingId === tag.id}
                    className="text-xs text-red-600 hover:text-red-800 disabled:opacity-40 transition-colors"
                  >
                    {deletingId === tag.id ? "Removing…" : "Remove"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
