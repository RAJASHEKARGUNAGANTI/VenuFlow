import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, "Password must be at least 6 characters").optional(),
}).refine((d) => {
  // If newPassword is provided, currentPassword must also be provided
  if (d.newPassword && !d.currentPassword) return false;
  return true;
}, { message: "Current password is required to set a new password", path: ["currentPassword"] });

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id?: string };
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json(profile);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id?: string };
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { name, email, currentPassword, newPassword } = parsed.data;

  // Fetch current user for password verification
  const existing = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, password: true, email: true },
  });
  if (!existing) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // If email changed, check uniqueness
  if (email !== existing.email) {
    const taken = await prisma.user.findUnique({ where: { email } });
    if (taken) return NextResponse.json({ error: { email: ["Email is already in use"] } }, { status: 409 });
  }

  // Validate current password if changing password
  if (newPassword) {
    const valid = await bcrypt.compare(currentPassword!, existing.password);
    if (!valid) {
      return NextResponse.json({ error: { currentPassword: ["Current password is incorrect"] } }, { status: 400 });
    }
  }

  const updateData: Record<string, unknown> = { name, email };
  if (newPassword) {
    updateData.password = await bcrypt.hash(newPassword, 12);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: updateData,
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json(updated);
}
