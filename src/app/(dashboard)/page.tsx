import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVenueFilter } from "@/lib/venueFilter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, CalendarCheck, CreditCard, Users, AlertCircle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookingStatus } from "@prisma/client";
import { BookingCalendar } from "@/components/dashboard/BookingCalendar";

export default async function DashboardPage() {
  const session = await auth();

  if ((session?.user as { role?: string } | undefined)?.role === "SUPER_ADMIN") {
    redirect("/super-admin");
  }

  // Read fresh from DB — handles multi-venue admins and stale JWTs
  const [bookingVenueFilter, clientVenueFilter] = await Promise.all([
    getVenueFilter(session, "hall.venueId"),
    getVenueFilter(session, "venueId"),
  ]);

  const [totalBookings, confirmedToday, totalClients, outstandingBookings] = await Promise.all([
    prisma.booking.count({ where: bookingVenueFilter }),
    prisma.booking.count({
      where: {
        ...bookingVenueFilter,
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS] },
        startDate: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lte: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      },
    }),
    prisma.client.count({ where: clientVenueFilter }),
    prisma.booking.findMany({
      where: { ...bookingVenueFilter, balanceAmount: { gt: 0 }, status: { not: BookingStatus.CANCELLED } },
      select: { id: true, bookingNumber: true, balanceAmount: true, client: { select: { name: true } } },
      orderBy: { balanceAmount: "desc" },
      take: 5,
    }),
  ]);

  const totalOutstanding = outstandingBookings.reduce((s: number, b: { balanceAmount: number }) => s + b.balanceAmount, 0);

  const stats = [
    { label: "Total Bookings", value: totalBookings, icon: CalendarCheck, color: "text-blue-600", href: "/bookings" },
    { label: "Events Today", value: confirmedToday, icon: Building2, color: "text-green-600", href: "/bookings" },
    { label: "Total Clients", value: totalClients, icon: Users, color: "text-purple-600", href: "/clients" },
    { label: "Outstanding (₹)", value: `₹${totalOutstanding.toLocaleString("en-IN")}`, icon: CreditCard, color: "text-orange-600", href: "/payments" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Welcome back, {session?.user?.name}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, href }) => (
          <Link key={label} href={href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className={`h-4 w-4 ${color}`} />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Booking Calendar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" />
            Bookings Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BookingCalendar />
        </CardContent>
      </Card>

      {/* Outstanding Balances */}
      {outstandingBookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              Outstanding Balances
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {outstandingBookings.map((b) => (
                <Link key={b.id} href={`/bookings/${b.id}/payments`}>
                  <div className="flex justify-between items-center py-2 px-3 rounded-md hover:bg-muted transition-colors">
                    <div>
                      <p className="text-sm font-medium">{b.client.name}</p>
                      <p className="text-xs text-muted-foreground">#{b.bookingNumber.slice(-8)}</p>
                    </div>
                    <span className="text-sm font-semibold text-orange-600">
                      ₹{b.balanceAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
