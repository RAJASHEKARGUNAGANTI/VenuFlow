"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Building2, CalendarCheck, Users, CreditCard, UserCog,
  BarChart3, Settings, Package, Truck, LayoutDashboard,
} from "lucide-react";

const navItems = [
  { label: "Dashboard",   href: "/",          icon: LayoutDashboard },
  { label: "Venues & Halls", href: "/venues",  icon: Building2 },
  { label: "Bookings",    href: "/bookings",  icon: CalendarCheck },
  { label: "Clients",     href: "/clients",   icon: Users },
  { label: "Payments",    href: "/payments",  icon: CreditCard },
  { label: "Staff",       href: "/staff",     icon: UserCog },
  { label: "Resources",   href: "/resources", icon: Package },
  { label: "Vendors",     href: "/vendors",   icon: Truck },
  { label: "Reports",     href: "/reports",   icon: BarChart3 },
  { label: "Settings",    href: "/settings",  icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-56 bg-card border-r hidden md:flex flex-col">
      {/* Logo */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b">
        <div className="p-1.5 bg-primary rounded-lg">
          <Building2 className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-semibold text-sm">VenueFlow</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
