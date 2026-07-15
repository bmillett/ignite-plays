import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import bcrypt from "bcryptjs";

const VALID_KEYS = ["team_password", "admin_password"] as const;
type PasswordKey = (typeof VALID_KEYS)[number];

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { key, password, confirmPassword } = await req.json();

  if (!VALID_KEYS.includes(key as PasswordKey)) {
    return NextResponse.json(
      { error: "key must be 'team_password' or 'admin_password'" },
      { status: 400 }
    );
  }

  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  if (password !== confirmPassword) {
    return NextResponse.json(
      { error: "Passwords do not match" },
      { status: 400 }
    );
  }

  const hash = await bcrypt.hash(password, 12);

  // Upsert into settings table
  await db
    .insert(settings)
    .values({ key, value: hash })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: hash, updatedAt: new Date() },
    });

  return NextResponse.json({ ok: true });
}
