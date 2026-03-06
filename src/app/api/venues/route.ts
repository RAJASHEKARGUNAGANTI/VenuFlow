import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { assertActive } from "@/lib/assertActive";

const createSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  gstNumber: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id?: string; email?: string | null; role?: string };

  let where: Record<string, unknown> = {};

  if (user.role === "SUPER_ADMIN") {
    // See all venues
  } else if (user.role === "ADMIN") {
    // Look up the admin's DB id by email (JWT id may be stale/missing)
    const lookup = user.email ? { email: user.email } : user.id ? { id: user.id } : null;
    if (!lookup) return NextResponse.json([], { status: 200 });
    const dbUser = await (prisma.user as any).findUnique({ where: lookup, select: { id: true, venueId: true } });
    if (!dbUser) return NextResponse.json([], { status: 200 });
    // New venues use adminId; legacy venues use User.venueId — include both
    const orClauses: Record<string, unknown>[] = [{ adminId: dbUser.id }];
    if (dbUser.venueId) orClauses.push({ id: dbUser.venueId });
    where = orClauses.length === 1 ? orClauses[0] : { OR: orClauses };
  } else {
    // Staff — scoped to their assigned venue
    const lookup = user.email ? { email: user.email } : user.id ? { id: user.id } : null;
    if (!lookup) return NextResponse.json([], { status: 200 });
    const dbUser = await (prisma.user as any).findUnique({ where: lookup, select: { venueId: true } });
    if (!dbUser?.venueId) return NextResponse.json([], { status: 200 });
    where = { id: dbUser.venueId };
  }

  const venues = await prisma.venue.findMany({
    where,
    include: { _count: { select: { halls: true, clients: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(venues);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await assertActive(session); if (blocked) return blocked;

  const user = session.user as { id?: string; email?: string | null; role?: string };
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Look up the admin's DB id
  const lookup = user.email ? { email: user.email } : user.id ? { id: user.id } : null;
  if (!lookup) return NextResponse.json({ error: "Cannot identify user" }, { status: 400 });
  const dbUser = await (prisma.user as any).findUnique({ where: lookup, select: { id: true } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 400 });

  const venue = await (prisma.venue as any).create({
    data: { ...parsed.data, adminId: dbUser.id },
  });

  return NextResponse.json(venue, { status: 201 });
}
