/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PaymentMode, PaymentPurpose } from "@prisma/client";
import { z } from "zod";
import { assertActive } from "@/lib/assertActive";

const createSchema = z.object({
  amount: z.number().positive(),
  mode: z.nativeEnum(PaymentMode),
  purpose: z.nativeEnum(PaymentPurpose),
  transactionRef: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
  isRefund: z.boolean().optional().default(false),
  notes: z.string().optional(),
  receivedAt: z.string().datetime().optional(),
});

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payments = await prisma.payment.findMany({
    where: { bookingId: params.id },
    include: { receivedBy: { select: { name: true } } },
    orderBy: { receivedAt: "desc" },
  });

  return NextResponse.json(payments);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await assertActive(session); if (blocked) return blocked;

  const user = session.user as { id?: string };
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    select: { paidAmount: true, grandTotal: true, createdById: true },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const { amount, isRefund, receivedAt, metadata, ...rest } = parsed.data;

  const payment = await (prisma.payment.create as any)({
    data: {
      bookingId: params.id,
      amount,
      isRefund: isRefund ?? false,
      receivedById: user.id!,
      receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
      metadata: metadata ?? null,
      ...rest,
    },
    include: { receivedBy: { select: { name: true } } },
  });

  // Update paidAmount and balanceAmount on booking
  const adjustment = isRefund ? -amount : amount;
  const newPaid = Math.max(0, booking.paidAmount + adjustment);
  const newBalance = Math.max(0, booking.grandTotal - newPaid);

  await prisma.booking.update({
    where: { id: params.id },
    data: { paidAmount: newPaid, balanceAmount: newBalance },
  });

  // Auto-regenerate invoice if one exists so it reflects latest payment
  await autoUpdateInvoice(params.id, user.id ?? booking.createdById);

  return NextResponse.json(payment, { status: 201 });
}

// Shared invoice refresh logic
async function autoUpdateInvoice(bookingId: string, issuedById: string) {
  const existing = await prisma.invoice.findFirst({
    where: { bookingId },
    orderBy: { issuedAt: "desc" },
  });
  if (!existing) return; // No invoice yet — user will generate manually

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { hall: true, amenities: true },
  });
  if (!booking) return;

  const activeAmenities = booking.amenities.filter((a) => !a.removedAt);
  const lineItems = [
    { description: `Hall Rental — ${booking.hall.name}`, quantity: 1, unitPrice: booking.baseAmount, amount: booking.baseAmount },
    ...activeAmenities.map((a) => ({ description: a.name, quantity: a.quantity, unitPrice: a.unitPrice, amount: a.totalPrice })),
  ];

  const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);
  const gstRate = 18;
  const gstAmount = Math.round((subtotal * gstRate) / 100);
  const grandTotal = subtotal + gstAmount;

  await prisma.invoice.update({
    where: { id: existing.id },
    data: { lineItems, subtotal, gstRate, gstAmount, grandTotal, issuedAt: new Date(), issuedById },
  });
}
