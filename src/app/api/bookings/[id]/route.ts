import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";
import { z } from "zod";
import { assertActive } from "@/lib/assertActive";

const updateSchema = z.object({
  status: z.nativeEnum(BookingStatus).optional(),
  notes: z.string().optional(),
  guestCount: z.number().int().positive().optional(),
});

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: {
      hall: { include: { venue: true } },
      client: true,
      amenities: {
        where: { removedAt: null },
        include: { amenityTemplate: { select: { category: true, unit: true } } },
        orderBy: { addedAt: "asc" },
      },
      payments: { include: { receivedBy: { select: { name: true } } }, orderBy: { receivedAt: "desc" } },
      invoices: { orderBy: { issuedAt: "desc" } },
      staffAssignments: { include: { staff: { select: { name: true, role: true } } } },
      bookingVendors: { include: { vendor: { select: { name: true, category: true } } } },
      createdBy: { select: { name: true } },
    },
  });

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(booking);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await assertActive(session); if (blocked) return blocked;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const booking = await prisma.booking.update({
    where: { id: params.id },
    data: parsed.data,
  });

  return NextResponse.json(booking);
}
