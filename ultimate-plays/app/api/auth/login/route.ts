import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { users, settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sessionOptions, SessionData } from "@/lib/session";
import bcrypt from "bcryptjs";

/**
 * Retrieve the effective password for a given key.
 * Priority: DB setting (bcrypt hash stored) → env var plaintext fallback.
 * Returns { hash: string | null, plain: string | null }
 */
async function getPasswordSetting(key: string) {
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);
  if (row) return { hash: row.value, plain: null };
  // Fall back to env var
  const plain = process.env[key === "team_password" ? "TEAM_PASSWORD" : "ADMIN_PASSWORD"];
  return { hash: null, plain: plain ?? null };
}

async function checkPassword(input: string, key: string): Promise<boolean> {
  const { hash, plain } = await getPasswordSetting(key);
  if (hash) return bcrypt.compare(input, hash);
  if (plain) return input === plain;
  return false;
}

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  // Look up email in the allowlist
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Admins use admin_password, everyone else uses team_password
  const passwordKey = user.role === "admin" ? "admin_password" : "team_password";
  const valid = await checkPassword(password, passwordKey);

  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Set session
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  session.email = user.email;
  session.role = user.role;
  await session.save();

  return NextResponse.json({ email: user.email, role: user.role });
}
