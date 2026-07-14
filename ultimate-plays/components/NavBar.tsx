"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function NavBar() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setIsAdmin(data?.role === "admin"))
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
      {/* Left: logo always visible */}
      <Link
        href="/"
        className="text-lg font-bold tracking-tight text-gray-900 hover:text-green-700 transition-colors shrink-0"
      >
        🥏 Ultimate Plays
      </Link>

      {/* Right: nav actions */}
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <Link
          href="/"
          className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          🏠 <span className="hidden sm:inline">All Plays</span>
        </Link>
        {isAdmin && (
          <Link
            href="/admin/users"
            className="rounded-md border border-purple-200 bg-purple-50 px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100 transition-colors"
          >
            ⚙️ <span className="hidden sm:inline">Admin</span>
          </Link>
        )}
        <button
          onClick={handleLogout}
          className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <span className="hidden sm:inline">Log out</span>
          <span className="sm:hidden">↩</span>
        </button>
      </div>
    </header>
  );
}
