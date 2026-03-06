import { PrismaClient } from "@prisma/client";
import { UserRole, AmenityCategory } from "@prisma/client";
import bcrypt from "bcryptjs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({} as any);

async function main() {
  console.log("Seeding database...");

  const hashedPassword = await bcrypt.hash("admin123", 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@venueflow.com" },
    update: {},
    create: {
      name: "Super Admin",
      email: "superadmin@venueflow.com",
      password: hashedPassword,
      role: UserRole.SUPER_ADMIN,
    },
  });
  console.log("Created super admin:", superAdmin.email);

  const admin = await prisma.user.upsert({
    where: { email: "admin@venueflow.com" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@venueflow.com",
      password: hashedPassword,
      role: UserRole.ADMIN,
    },
  });
  console.log("Created admin:", admin.email);

  const venue = await prisma.venue.upsert({
    where: { id: "default-venue" },
    update: {},
    create: {
      id: "default-venue",
      name: "Grand Convention Centre",
      address: "123 Main Street",
      city: "Hyderabad",
      phone: "+91 98765 43210",
      email: "info@grandcentre.com",
      gstNumber: "36AABCU9603R1ZX",
    },
  });
  console.log("Created venue:", venue.name);

  await prisma.hall.upsert({
    where: { id: "hall-1" },
    update: {},
    create: {
      id: "hall-1",
      venueId: venue.id,
      name: "Royal Banquet Hall",
      capacity: 500,
      basePrice: 50000,
      description: "Spacious hall for weddings and large events",
    },
  });

  const amenities = [
    { name: "Stage Decoration", category: AmenityCategory.DECORATION, defaultPrice: 15000, unit: "per event" },
    { name: "Floral Decoration", category: AmenityCategory.DECORATION, defaultPrice: 10000, unit: "per event" },
    { name: "DJ & Sound System", category: AmenityCategory.ENTERTAINMENT, defaultPrice: 20000, unit: "per event" },
    { name: "Projector & Screen", category: AmenityCategory.AUDIO_VISUAL, defaultPrice: 5000, unit: "per event" },
    { name: "Photography", category: AmenityCategory.PHOTOGRAPHY, defaultPrice: 25000, unit: "per event" },
    { name: "Catering (Veg)", category: AmenityCategory.CATERING, defaultPrice: 450, unit: "per plate" },
    { name: "Catering (Non-Veg)", category: AmenityCategory.CATERING, defaultPrice: 650, unit: "per plate" },
    { name: "Extra Chairs", category: AmenityCategory.FURNITURE, defaultPrice: 50, unit: "per chair" },
    { name: "Extra Tables", category: AmenityCategory.FURNITURE, defaultPrice: 200, unit: "per table" },
  ];

  for (const amenity of amenities) {
    await prisma.amenityTemplate.create({ data: amenity }).catch(() => {});
  }

  console.log("Created amenity templates");
  console.log("\nSeed complete! Login: admin@venueflow.com / admin123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
