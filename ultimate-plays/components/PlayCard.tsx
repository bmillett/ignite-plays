"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SessionData } from "@/lib/session";

export interface Play {
  id: number;
  name: string;
  description: string | null;
  createdByEmail: string;
  updatedAt: string;
  tags: string[];
}

const TAG_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-green-100 text-green-700",
  "bg-yellow-100 text-yellow-700",
  "bg-purple-100 text-purple-700",
  "bg-pink-100 text-pink-700",
  "bg-orange-100 text-orange-700",
  "bg-teal-100 text-teal-700",
];

function tagColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_COLORS[hash % TAG_COLORS.length];
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

interface Props {
  play: Play;
  onDeleted: (id: number) => void;
  role: SessionData["role"];
}

export default function PlayCard({ play, onDeleted, role }: Props) {
  const router = useRouter();
  const canEdit = role === "editor" || role === "admin";

  async function handleDelete() {
    if (!confirm(`Delete "${play.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/plays/${play.id}`, { method: "DELETE" });
    if (res.ok) {
      onDeleted(play.id);
    } else {
      alert("Failed to delete play. Please try again.");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Name */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 leading-snug">{play.name}</h2>
        {play.description && (
          <p className="mt-1 text-sm text-gray-500 line-clamp-2">{play.description}</p>
        )}
      </div>

      {/* Tags */}
      {play.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {play.tags.map((tag) => (
            <span key={tag} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tagColor(tag)}`}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100">
        <span className="text-xs text-gray-400">Updated {formatDate(play.updatedAt)}</span>
        <div className="flex gap-2">
          <Link
            href={`/plays/${play.id}`}
            className="rounded-md bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 border border-gray-200 hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            View
          </Link>
          {canEdit && (
            <Link
              href={`/plays/${play.id}/edit`}
              className="rounded-md bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 border border-blue-200 hover:bg-blue-100 active:bg-blue-200 transition-colors"
            >
              Edit
            </Link>
          )}
          {canEdit && (
            <button
              onClick={handleDelete}
              className="rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-100 active:bg-red-200 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
