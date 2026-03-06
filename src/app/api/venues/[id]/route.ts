import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { canAccessVenue } from "@/lib/venueFilter";
import { assertActive } from "@/lib/assertActive";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  gstNumber: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await canAccessVenue(session, params.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [venue, totalBookings] = await Promise.all([
    prisma.venue.findUnique({
      where: { id: params.id },
      include: {
        halls: { include: { _count: { select: { bookings: true } } } },
        _count: { select: { clients: true, staff: true } },
      },
    }),
    prisma.booking.count({ where: { hall: { venueId: params.id } } }),
  ]);

  if (!venue) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...venue, totalBookings });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await assertActive(session); if (blocked) return blocked;

  const user = session.user as { role?: string };
  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!(await canAccessVenue(session, params.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const venue = await prisma.venue.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json(venue);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await assertActive(session); if (blocked) return blocked;

  const user = session.user as { role?: string };
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!(await canAccessVenue(session, params.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Block deletion only if this venue's halls have active bookings
  const activeBookings = await prisma.booking.count({
    where: { hall: { venueId: params.id }, status: { notIn: ["CANCELLED", "COMPLETED"] } },
  });
  if (activeBookings > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${activeBookings} active booking(s) exist. Cancel or complete them first.` },
      { status: 409 }
    );
  }

  // Cascade delete manually (MongoDB/Prisma has no automatic cascade)
  const [halls, clients] = await Promise.all([
    prisma.hall.findMany({ where: { venueId: params.id }, select: { id: true } }),
    prisma.client.findMany({ where: { venueId: params.id }, select: { id: true } }),
  ]);
  const hallIds = halls.map((h) => h.id);
  const clientIds = clients.map((c) => c.id);

  // Collect ALL booking IDs — via halls (in this venue) AND via clients (may be cross-venue)
  const bookingResults = await prisma.booking.findMany({
    where: {
      OR: [
        ...(hallIds.length > 0 ? [{ hallId: { in: hallIds } }] : []),
        ...(clientIds.length > 0 ? [{ clientId: { in: clientIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const bookingIds = [...new Set(bookingResults.map((b) => b.id))];

  if (bookingIds.length > 0) {
    await prisma.bookingAmenity.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.payment.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.invoice.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.staffAssignment.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.resourceAllocation.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.bookingVendor.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
  }

  if (hallIds.length > 0) {
    await prisma.hallAmenity.deleteMany({ where: { hallId: { in: hallIds } } });
    await prisma.blockedDate.deleteMany({ where: { hallId: { in: hallIds } } });
    await prisma.hall.deleteMany({ where: { id: { in: hallIds } } });
  }

  await prisma.client.deleteMany({ where: { venueId: params.id } });
  await prisma.staffAssignment.deleteMany({ where: { staff: { venueId: params.id } } });
  await prisma.staff.deleteMany({ where: { venueId: params.id } });
  await prisma.resourceAllocation.deleteMany({ where: { resource: { venueId: params.id } } });
  await prisma.resource.deleteMany({ where: { venueId: params.id } });
  await prisma.bookingVendor.deleteMany({ where: { vendor: { venueId: params.id } } });
  await prisma.vendor.deleteMany({ where: { venueId: params.id } });

  // Unlink staff users assigned to this venue
  await (prisma.user as any).updateMany({ where: { venueId: params.id }, data: { venueId: null } });

  await prisma.venue.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
