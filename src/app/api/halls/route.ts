import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

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

  const venueId = req.nextUrl.searchParams.get("venueId");
  const user = session.user as { role?: string; venueId?: string | null };

  const where: { venueId?: string } = {};
  if (venueId) {
    where.venueId = venueId;
  } else if (user.role !== "ADMIN" && user.venueId) {
    where.venueId = user.venueId;
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
