import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

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

  const user = session.user as { role?: string; venueId?: string | null };
  const venueId = req.nextUrl.searchParams.get("venueId");

  const where: Record<string, unknown> = { isActive: true };
  if (venueId) where.venueId = venueId;
  else if (user.role !== "ADMIN" && user.venueId) where.venueId = user.venueId;

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

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const staff = await prisma.staff.create({ data: parsed.data });
  return NextResponse.json(staff, { status: 201 });
}
