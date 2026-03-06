import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const user = session.user as { role?: string; venueId?: string | null };
  const venueFilter = user.role !== "ADMIN" && user.venueId
    ? { hall: { venueId: user.venueId } }
    : {};

  const dateFilter = from && to
    ? { receivedAt: { gte: new Date(from), lte: new Date(to) } }
    : {};

  const payments = await (prisma.payment as any).findMany({
    where: { booking: venueFilter, ...dateFilter },
    include: {
      booking: {
        select: {
          id: true,
          bookingNumber: true,
          grandTotal: true,
          paidAmount: true,
          balanceAmount: true,
          status: true,
          startDate: true,
          client: { select: { name: true, phone: true, email: true } },
          hall: { select: { name: true, venue: { select: { name: true } } } },
        },
      },
      receivedBy: { select: { name: true } },
    },
    orderBy: { receivedAt: "desc" },
    take: 500,
  });

  return NextResponse.json(payments);
}
