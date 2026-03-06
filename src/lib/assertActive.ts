/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";

/**
 * Returns a 403 NextResponse if the session user's account is deactivated.
 * Returns null if the user is active (proceed normally).
 * SUPER_ADMIN is never subject to this check.
 */
export async function assertActive(session: Session | null): Promise<NextResponse | null> {
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role;
  if (role === "SUPER_ADMIN") return null;

  const id = (session.user as { id?: string }).id;
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await (prisma.user as any).findUnique({
    where: { id },
    select: { isActive: true },
  });

  if (!user?.isActive) {
    return NextResponse.json(
      { error: "Account deactivated. Contact super admin." },
      { status: 403 }
    );
  }
  return null;
}
