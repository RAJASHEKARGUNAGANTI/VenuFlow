import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { assertActive } from "@/lib/assertActive";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  capacity: z.preprocess((v) => v == null ? undefined : Number(v), z.number().int().positive().optional()),
  basePrice: z.preprocess((v) => v == null ? undefined : Number(v), z.number().positive().optional()),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await assertActive(session); if (blocked) return blocked;

  const user = session.user as { role?: string };
  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const hall = await prisma.hall.update({
    where: { id: params.id },
    data: parsed.data,
  });

  return NextResponse.json(hall);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await assertActive(session); if (blocked) return blocked;

  const user = session.user as { role?: string };
  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Soft delete — preserves booking history
  await prisma.hall.update({ where: { id: params.id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
