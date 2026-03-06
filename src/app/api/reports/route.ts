import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";
import { getVenueFilter } from "@/lib/venueFilter";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = req.nextUrl;
  const from = url.searchParams.get("from") ?? new Date(new Date().getFullYear(), 0, 1).toISOString();
  const to = url.searchParams.get("to") ?? new Date().toISOString();

  const venueFilter = await getVenueFilter(session, "hall.venueId");

  const dateFilter = {
    startDate: { gte: new Date(from), lte: new Date(to) },
  };

  const [bookings, payments] = await Promise.all([
    prisma.booking.findMany({
      where: { ...venueFilter, ...dateFilter, status: { not: BookingStatus.CANCELLED } },
      select: {
        id: true,
        eventType: true,
        status: true,
        grandTotal: true,
        paidAmount: true,
        balanceAmount: true,
        startDate: true,
        hall: { select: { name: true, venue: { select: { name: true } } } },
      },
    }),
    prisma.payment.findMany({
      where: {
        booking: { ...venueFilter, ...dateFilter },
        isRefund: false,
      },
      select: { amount: true, mode: true, purpose: true, receivedAt: true },
    }),
  ]);

  const totalRevenue = payments.reduce((s: number, p: { amount: number }) => s + p.amount, 0);
  const totalOutstanding = bookings.reduce((s: number, b: { balanceAmount: number }) => s + b.balanceAmount, 0);
  const totalBookings = bookings.length;

  // Revenue by event type
  const byEventType: Record<string, { count: number; revenue: number }> = {};
  for (const b of bookings) {
    const key = b.eventType;
    if (!byEventType[key]) byEventType[key] = { count: 0, revenue: 0 };
    byEventType[key].count++;
    byEventType[key].revenue += b.paidAmount;
  }

  // Revenue by month
  const byMonth: Record<string, number> = {};
  for (const p of payments) {
    const key = new Date(p.receivedAt).toLocaleString("en-IN", { month: "short", year: "numeric" });
    byMonth[key] = (byMonth[key] ?? 0) + p.amount;
  }

  // Payment mode breakdown
  const byMode: Record<string, number> = {};
  for (const p of payments) {
    byMode[p.mode] = (byMode[p.mode] ?? 0) + p.amount;
  }

  // Status breakdown
  const byStatus: Record<string, number> = {};
  for (const b of bookings) {
    byStatus[b.status] = (byStatus[b.status] ?? 0) + 1;
  }

  return NextResponse.json({
    summary: { totalRevenue, totalOutstanding, totalBookings },
    byEventType,
    byMonth,
    byMode,
    byStatus,
  });
}
