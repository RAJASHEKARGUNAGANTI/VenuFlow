import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  let isDeactivated = false;
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (session?.user && role !== "SUPER_ADMIN") {
    const id = (session.user as { id?: string }).id;
    if (id) {
      const u = await (prisma.user as any).findUnique({ where: { id }, select: { isActive: true } });
      isDeactivated = u?.isActive === false;
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Sidebar />
      <div className="md:ml-56 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 p-6">{children}</main>
      </div>
      {isDeactivated && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium px-5 py-3 shadow-lg">
          <span className="shrink-0">⚠</span>
          Your account has been deactivated. Please contact the super admin.
        </div>
      )}
    </div>
  );
}
