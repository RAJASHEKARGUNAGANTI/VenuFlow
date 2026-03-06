import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getUserVenueIds } from "@/lib/venueFilter";
import { assertActive } from "@/lib/assertActive";

const createSchema = z.object({
  venueId: z.string().min(1),
  name: z.string().min(1),
  capacity: z.number().int().positive(),
  basePrice: z.number().positive(),
  description: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const venueIdParam = req.nextUrl.searchParams.get("venueId");

  // Read fresh from DB to avoid stale JWT venueId
  const venueIds = await getUserVenueIds(session);

  const where: Record<string, unknown> = {};
  if (venueIds === null) {
    // SUPER_ADMIN — optionally filter by param
    if (venueIdParam) where.venueId = venueIdParam;
  } else if (venueIds.length === 0) {
    where.venueId = "__none__";
  } else {
    where.venueId = venueIds.length === 1 ? venueIds[0] : { in: venueIds };
  }

  const halls = await prisma.hall.findMany({
    where: { ...where, isActive: true },
    include: { venue: { select: { name: true } }, _count: { select: { bookings: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(halls);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await assertActive(session); if (blocked) return blocked;

  const user = session.user as { role?: string };
  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const hall = await prisma.hall.create({ data: parsed.data });
  return NextResponse.json(hall, { status: 201 });
}
