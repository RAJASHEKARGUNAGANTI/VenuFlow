import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getVenueFilter } from "@/lib/venueFilter";
import { assertActive } from "@/lib/assertActive";

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  notes: z.string().optional(),
  venueId: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const search = req.nextUrl.searchParams.get("q") ?? "";

  const venueFilter = await getVenueFilter(session);
  const where: Record<string, unknown> = { ...venueFilter };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const clients = await prisma.client.findMany({
    where,
    include: { _count: { select: { bookings: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await assertActive(session); if (blocked) return blocked;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Check if client with same phone exists
  const existing = await prisma.client.findFirst({
    where: { phone: parsed.data.phone, venueId: parsed.data.venueId },
  });

  if (existing) {
    // Mark as repeat customer
    await prisma.client.update({ where: { id: existing.id }, data: { isRepeat: true } });
    return NextResponse.json({ ...existing, isRepeat: true, alreadyExists: true });
  }

  const client = await prisma.client.create({ data: parsed.data });
  return NextResponse.json(client, { status: 201 });
}
