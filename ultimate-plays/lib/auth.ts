import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, SessionData } from "./session";
import { NextResponse } from "next/server";

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

/**
 * Returns the session data if authenticated, or a 401 NextResponse.
 */
export async function requireAuth(): Promise<SessionData | NextResponse> {
  const session = await getSession();
  if (!session.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { email: session.email, role: session.role };
}

/**
 * Returns the session data if the user is admin, or a 401/403 NextResponse.
 */
export async function requireAdmin(): Promise<SessionData | NextResponse> {
  const session = await getSession();
  if (!session.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { email: session.email, role: session.role };
}

/**
 * Returns the session data if the user can edit (editor or admin), or a 401/403 NextResponse.
 */
export async function requireEditor(): Promise<SessionData | NextResponse> {
  const session = await getSession();
  if (!session.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "editor" && session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { email: session.email, role: session.role };
}
