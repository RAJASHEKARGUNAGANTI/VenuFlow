import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { BookingStatus, EventType, TimeSlot } from "@prisma/client";
import { nanoid } from "@/lib/utils";
import { getVenueFilter } from "@/lib/venueFilter";
import { assertActive } from "@/lib/assertActive";

const createSchema = z.object({
  hallId: z.string().min(1),
  clientId: z.string().min(1),
  eventType: z.nativeEnum(EventType),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  timeSlot: z.nativeEnum(TimeSlot),
  guestCount: z.number().int().positive(),
  notes: z.string().optional(),
  baseAmount: z.number().min(0),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = req.nextUrl;
  const status = url.searchParams.get("status") as BookingStatus | null;
  const hallId = url.searchParams.get("hallId");
  const clientId = url.searchParams.get("clientId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const venueFilter = await getVenueFilter(session, "hall.venueId");
  const where: Record<string, unknown> = { ...venueFilter };
  if (status) where.status = status;
  if (hallId) where.hallId = hallId;
  if (clientId) where.clientId = clientId;
  if (from || to) {
    where.startDate = {};
    if (from) (where.startDate as Record<string, unknown>).gte = new Date(from);
    if (to) (where.startDate as Record<string, unknown>).lte = new Date(to);
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      hall: { select: { name: true, venue: { select: { name: true } } } },
      client: { select: { name: true, phone: true } },
    },
    orderBy: { startDate: "desc" },
    take: 200,
  });

  return NextResponse.json(bookings);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await assertActive(session); if (blocked) return blocked;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { hallId, startDate, endDate, timeSlot, baseAmount } = parsed.data;

  // Conflict detection
  const conflict = await prisma.booking.findFirst({
    where: {
      hallId,
      status: { notIn: [BookingStatus.CANCELLED] },
      AND: [
        { startDate: { lte: new Date(endDate) } },
        { endDate: { gte: new Date(startDate) } },
        ...(timeSlot !== TimeSlot.FULL_DAY
          ? [{ OR: [{ timeSlot: timeSlot }, { timeSlot: TimeSlot.FULL_DAY }] }]
          : []),
      ],
    },
  });

  if (conflict) {
    return NextResponse.json(
      { error: "Hall is already booked for this date and time slot" },
      { status: 409 }
    );
  }

  const user = session.user as { id?: string };
  const bookingNumber = `BK-${nanoid(8).toUpperCase()}`;

  const booking = await prisma.booking.create({
    data: {
      ...parsed.data,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      bookingNumber,
      grandTotal: baseAmount,
      balanceAmount: baseAmount,
      createdById: user.id!,
    },
    include: {
      hall: { select: { name: true } },
      client: { select: { name: true } },
    },
  });

  return NextResponse.json(booking, { status: 201 });
}
