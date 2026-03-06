import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { assertActive } from "@/lib/assertActive";

const addSchema = z.object({
  amenityTemplateId: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().min(0),
});

// GET all active amenities for a booking
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const all = await prisma.bookingAmenity.findMany({
    where: { bookingId: params.id },
    include: { amenityTemplate: { select: { name: true, category: true, unit: true } } },
    orderBy: { addedAt: "asc" },
  });

  // Filter in JS — Prisma MongoDB null filter can miss stored-null vs missing-field docs
  return NextResponse.json(all.filter((a) => !a.removedAt));
}

// POST — add a new amenity to a booking
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await assertActive(session); if (blocked) return blocked;

  const user = session.user as { id?: string };
  const body = await req.json();
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { amenityTemplateId, quantity, unitPrice } = parsed.data;
  const totalPrice = quantity * unitPrice;

  const template = await prisma.amenityTemplate.findUnique({ where: { id: amenityTemplateId } });
  if (!template) return NextResponse.json({ error: "Amenity template not found" }, { status: 404 });

  // Add amenity record
  const amenity = await prisma.bookingAmenity.create({
    data: {
      bookingId: params.id,
      amenityTemplateId,
      name: template.name,
      quantity,
      unitPrice,
      totalPrice,
      addedById: user.id!,
    },
  });

  // Recalculate totals
  await recalculateBookingTotals(params.id);

  return NextResponse.json(amenity, { status: 201 });
}

// DELETE — soft-remove an amenity from a booking
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await assertActive(session); if (blocked) return blocked;

  const { amenityId } = await req.json();
  if (!amenityId) return NextResponse.json({ error: "amenityId required" }, { status: 400 });

  await prisma.bookingAmenity.update({
    where: { id: amenityId, bookingId: params.id },
    data: { removedAt: new Date() },
  });

  // Recalculate totals
  await recalculateBookingTotals(params.id);

  return NextResponse.json({ success: true });
}

async function recalculateBookingTotals(bookingId: string) {
  const [booking, allAmenities] = await Promise.all([
    prisma.booking.findUnique({ where: { id: bookingId }, select: { baseAmount: true, paidAmount: true } }),
    prisma.bookingAmenity.findMany({
      where: { bookingId },
      select: { totalPrice: true, removedAt: true },
    }),
  ]);

  if (!booking) return;

  const activeAmenities = allAmenities.filter((a) => !a.removedAt);
  const amenityTotal = activeAmenities.reduce((sum: number, a: { totalPrice: number }) => sum + a.totalPrice, 0);
  const grandTotal = booking.baseAmount + amenityTotal;
  const balanceAmount = Math.max(0, grandTotal - booking.paidAmount);

  await prisma.booking.update({
    where: { id: bookingId },
    data: { amenityTotal, grandTotal, balanceAmount },
  });
}
