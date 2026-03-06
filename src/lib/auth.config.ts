import type { NextAuthConfig } from "next-auth";

// Edge-compatible auth config — no Prisma imports here.
// Used by middleware directly; full auth.ts spreads this + adds Credentials provider.
export const authConfig = {
  session: { strategy: "jwt" as const },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as unknown as { role: string; venueId: string | null };
        token.role = u.role;
        token.venueId = u.venueId;
      }
      return token;
    },
    session({ session, token }) {
      const u = session.user as unknown as {
        id: string;
        role: string;
        venueId: string | null;
      };
      u.id = token.sub!;
      u.role = token.role as string;
      u.venueId = token.venueId as string | null;
      return session;
    },
  },
} satisfies NextAuthConfig;
