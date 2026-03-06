import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isSuperAdmin(session: { user?: { role?: string } } | null) {
  return (session?.user as { role?: string })?.role === "SUPER_ADMIN";
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || !isSuperAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = params;
  const body = await req.json();

  const data: Record<string, unknown> = {};

  if (typeof body.isActive === "boolean") {
    data.isActive = body.isActive;
  }

  if ("venueId" in body) {
    // Allow assigning or clearing a venue: "" clears it, string assigns it
    data.venueId = body.venueId || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await (prisma.user as any).update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, isActive: true, venueId: true },
  });

  return NextResponse.json(updated);
}
