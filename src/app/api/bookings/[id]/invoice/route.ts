import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function generateInvoiceNumber(): string {
  const now = new Date();
  const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${suffix}`;
}

const invoiceInclude = {
  booking: {
    include: {
      hall: { include: { venue: true } },
      client: true,
      payments: { orderBy: { receivedAt: "asc" as const } },
    },
  },
  issuedBy: { select: { name: true } },
};

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invoice = await prisma.invoice.findFirst({
    where: { bookingId: params.id },
    orderBy: { issuedAt: "desc" },
    include: invoiceInclude,
  });

  if (!invoice) return NextResponse.json({ error: "No invoice" }, { status: 404 });
  return NextResponse.json(invoice);
}

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id?: string };

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: {
      hall: { include: { venue: true } },
      client: true,
      amenities: { orderBy: { addedAt: "asc" } },
      payments: { orderBy: { receivedAt: "asc" } },
    },
  });

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const activeAmenities = booking.amenities.filter((a) => !a.removedAt);

  const lineItems = [
    {
      description: `Hall Rental — ${booking.hall.name}`,
      quantity: 1,
      unitPrice: booking.baseAmount,
      amount: booking.baseAmount,
    },
    ...activeAmenities.map((a) => ({
      description: a.name,
      quantity: a.quantity,
      unitPrice: a.unitPrice,
      amount: a.totalPrice,
    })),
  ];

  const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);
  const gstRate = 18;
  const gstAmount = Math.round((subtotal * gstRate) / 100);
  const grandTotal = subtotal + gstAmount;
  const issuedById = user.id ?? booking.createdById;

  // Upsert: update existing invoice if present, else create
  const existing = await prisma.invoice.findFirst({
    where: { bookingId: params.id },
    orderBy: { issuedAt: "desc" },
  });

  if (existing) {
    const invoice = await prisma.invoice.update({
      where: { id: existing.id },
      data: { lineItems, subtotal, gstRate, gstAmount, grandTotal, issuedAt: new Date(), issuedById },
      include: invoiceInclude,
    });
    return NextResponse.json(invoice, { status: 200 });
  }

  const invoice = await prisma.invoice.create({
    data: { bookingId: params.id, invoiceNumber: generateInvoiceNumber(), lineItems, subtotal, gstRate, gstAmount, grandTotal, issuedById },
    include: invoiceInclude,
  });

  return NextResponse.json(invoice, { status: 201 });
}
