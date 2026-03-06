import { prisma } from "@/lib/prisma";

type Session = { user?: { id?: string; email?: string | null; role?: string } } | null;

// Resolves the list of venue IDs the current user is allowed to access.
//   null          → SUPER_ADMIN — global access, no filter
//   []            → unauthenticated or no venue assigned — match nothing
//   ["id", ...]   → scoped to these venues

async function resolveVenueIds(session: Session): Promise<string[] | null> {
  const user = session?.user as { id?: string; email?: string | null; role?: string } | undefined;
  if (!user) return [];

  if (user.role === "SUPER_ADMIN") return null; // global access

  const lookup = user.email
    ? { email: user.email }
    : user.id
    ? { id: user.id }
    : null;

  if (!lookup) return [];

  if (user.role === "ADMIN") {
    // Admins own venues via adminId on each Venue record.
    // Also include the legacy venueId on the User record (for venues created before adminId was added).
    const dbUser = await (prisma.user as any).findUnique({
      where: lookup,
      select: { id: true, venueId: true },
    });
    if (!dbUser) return [];
    const venues = await (prisma.venue as any).findMany({
      where: { adminId: dbUser.id },
      select: { id: true },
    });
    const ids = new Set<string>(venues.map((v: { id: string }) => v.id));
    // Legacy fallback: venue assigned directly on User record
    if (dbUser.venueId) ids.add(dbUser.venueId as string);
    return Array.from(ids);
  }

  // Staff roles (MANAGER, RECEPTIONIST, ACCOUNTANT) — scoped to their single assigned venue
  const dbUser = await (prisma.user as any).findUnique({
    where: lookup,
    select: { venueId: true },
  });
  return dbUser?.venueId ? [dbUser.venueId as string] : [];
}

/**
 * Returns a Prisma `where` filter object to scope queries to the current user's venues.
 *
 * @param field "venueId"         – when the model has a direct venueId column
 *              "hall.venueId"    – when scoping via a nested hall relation
 */
export async function getVenueFilter(
  session: Session,
  field: "venueId" | "hall.venueId" = "venueId"
): Promise<Record<string, unknown>> {
  const ids = await resolveVenueIds(session);

  if (ids === null) return {}; // SUPER_ADMIN — global access

  if (ids.length === 0) return { id: "__impossible__" }; // no access — match nothing

  const venueFilter = ids.length === 1 ? ids[0] : { in: ids };

  if (field === "hall.venueId") return { hall: { venueId: venueFilter } };
  return { venueId: venueFilter };
}

/**
 * Returns all venue IDs the user can access (null = SUPER_ADMIN global).
 */
export async function getUserVenueIds(session: Session): Promise<string[] | null> {
  return resolveVenueIds(session);
}

/**
 * Returns true if the user can access the given venueId.
 * SUPER_ADMIN always returns true.
 */
export async function canAccessVenue(session: Session, venueId: string): Promise<boolean> {
  const ids = await resolveVenueIds(session);
  if (ids === null) return true; // SUPER_ADMIN
  return ids.includes(venueId);
}

/**
 * @deprecated Use getUserVenueIds() or canAccessVenue() instead.
 * Returns the first venueId or null for SUPER_ADMIN, "" for no access.
 */
export async function getUserVenueId(session: Session): Promise<string | null> {
  const ids = await resolveVenueIds(session);
  if (ids === null) return null;
  return ids[0] ?? "";
}
