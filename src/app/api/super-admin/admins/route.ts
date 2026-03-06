/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";

function isSuperAdmin(session: unknown) {
  return (session as { user?: { role?: string } } | null)?.user?.role === "SUPER_ADMIN";
}

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  venueId: z.string().optional().or(z.literal("")),
});

export async function GET() {
  const session = await auth();
  if (!session || !isSuperAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const admins = await (prisma.user as any).findMany({
    where: { role: "ADMIN" },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      createdAt: true,
      venue: { select: { id: true, name: true } },
      _count: { select: { bookingsCreated: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch revenue per admin (sum of non-refund payments they received)
  const adminIds: string[] = admins.map((a: { id: string }) => a.id);
  const revenueRows = await (prisma.payment as any).groupBy({
    by: ["receivedById"],
    where: { receivedById: { in: adminIds }, isRefund: false },
    _sum: { amount: true },
  });

  const revenueMap: Record<string, number> = {};
  for (const row of revenueRows) {
    revenueMap[row.receivedById] = row._sum.amount ?? 0;
  }

  const result = admins.map((a: {
    id: string; name: string; email: string; isActive: boolean;
    createdAt: string; venue: { id: string; name: string } | null;
    _count: { bookingsCreated: number };
  }) => ({
    ...a,
    bookings: a._count.bookingsCreated,
    revenue: revenueMap[a.id] ?? 0,
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isSuperAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, password, venueId } = parsed.data;

  const existing = await (prisma.user as any).findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 10);

  const user = await (prisma.user as any).create({
    data: {
      name,
      email,
      password: hashed,
      role: "ADMIN",
      ...(venueId ? { venueId } : {}),
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  return NextResponse.json(user, { status: 201 });
}
