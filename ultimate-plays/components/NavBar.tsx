"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function NavBar() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setIsAdmin(data?.role === "admin"))
      .catch(() => {});
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAdminOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
      {/* Left: logo */}
      <Link
        href="/"
        className="text-lg font-bold tracking-tight text-gray-900 hover:text-green-700 transition-colors shrink-0"
      >
        🥏 Ignite Plays
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
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setAdminOpen((o) => !o)}
              className="flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100 transition-colors"
            >
              ⚙️ <span className="hidden sm:inline">Admin</span>
              <svg
                className={`w-3 h-3 ml-0.5 transition-transform ${adminOpen ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {adminOpen && (
              <div className="absolute right-0 mt-1 w-44 rounded-lg border border-gray-200 bg-white shadow-lg z-20 overflow-hidden">
                <Link
                  href="/admin/users"
                  onClick={() => setAdminOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <span>👥</span> Manage Users
                </Link>
                <Link
                  href="/admin/passwords"
                  onClick={() => setAdminOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
                >
                  <span>🔑</span> Passwords
                </Link>
              </div>
            )}
          </div>
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
