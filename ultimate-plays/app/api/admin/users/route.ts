import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const allUsers = await db
    .select({ id: users.id, email: users.email, role: users.role, createdAt: users.createdAt })
    .from(users)
    .orderBy(users.createdAt);

  return NextResponse.json(allUsers);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { email, role } = await req.json();

  if (!email || !["member", "admin"].includes(role)) {
    return NextResponse.json(
      { error: "Valid email and role (member|admin) are required" },
      { status: 400 }
    );
  }

  const [inserted] = await db
    .insert(users)
    .values({ email: email.toLowerCase().trim(), role })
    .returning({ id: users.id, email: users.email, role: users.role, createdAt: users.createdAt });

  return NextResponse.json(inserted, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Prevent self-deletion
  if (email.toLowerCase().trim() === auth.email) {
    return NextResponse.json(
      { error: "Cannot remove your own account" },
      { status: 400 }
    );
  }

  await db.delete(users).where(eq(users.email, email.toLowerCase().trim()));

  return NextResponse.json({ ok: true });
}
