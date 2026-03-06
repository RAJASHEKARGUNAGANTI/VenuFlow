import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [totalAdmins, activeAdmins, totalVenues, totalHalls, totalBookings, revenueAgg] =
    await Promise.all([
      (prisma.user as any).count({ where: { role: "ADMIN" } }),
      (prisma.user as any).count({ where: { role: "ADMIN", isActive: true } }),
      prisma.venue.count(),
      prisma.hall.count(),
      prisma.booking.count(),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { isRefund: false } }),
    ]);

  return NextResponse.json({
    totalAdmins,
    activeAdmins,
    totalVenues,
    totalHalls,
    totalBookings,
    totalRevenue: (revenueAgg._sum.amount as number | null) ?? 0,
  });
}
