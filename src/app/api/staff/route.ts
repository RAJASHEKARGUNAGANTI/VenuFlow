import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { assertActive } from "@/lib/assertActive";

const createSchema = z.object({
  venueId: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  role: z.string().min(1),
  salary: z.number().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { role?: string };
  const venueIdParam = req.nextUrl.searchParams.get("venueId");

  const { getUserVenueIds } = await import("@/lib/venueFilter");
  const venueIds = await getUserVenueIds(session);

  const where: Record<string, unknown> = { isActive: true };
  if (venueIds === null) {
    if (venueIdParam) where.venueId = venueIdParam;
  } else if (venueIds.length === 0) {
    where.venueId = "__none__";
  } else {
    where.venueId = venueIds.length === 1 ? venueIds[0] : { in: venueIds };
  }

  const staff = await prisma.staff.findMany({
    where,
    include: { venue: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(staff);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await assertActive(session); if (blocked) return blocked;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const staff = await prisma.staff.create({ data: parsed.data });
  return NextResponse.json(staff, { status: 201 });
}
