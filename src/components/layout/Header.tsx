"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  LogOut, User, Globe, Menu, Building2, LayoutDashboard,
  CalendarCheck, Users, CreditCard, UserCog, BarChart3,
  Settings, Package, Truck,
} from "lucide-react";

const navItems = [
  { label: "Dashboard",    href: "/",          icon: LayoutDashboard },
  { label: "Venues & Halls", href: "/venues",  icon: Building2 },
  { label: "Bookings",     href: "/bookings",  icon: CalendarCheck },
  { label: "Clients",      href: "/clients",   icon: Users },
  { label: "Payments",     href: "/payments",  icon: CreditCard },
  { label: "Staff",        href: "/staff",     icon: UserCog },
  { label: "Resources",    href: "/resources", icon: Package },
  { label: "Vendors",      href: "/vendors",   icon: Truck },
  { label: "Reports",      href: "/reports",   icon: BarChart3 },
  { label: "Settings",     href: "/settings",  icon: Settings },
];

const LANGS = [
  { code: "en", label: "English", native: "EN" },
  { code: "te", label: "Telugu",  native: "తె" },
  { code: "hi", label: "Hindi",   native: "हि" },
  { code: "ta", label: "Tamil",   native: "த" },
];

function doGTranslate(code: string) {
  const select = document.querySelector<HTMLSelectElement>(".goog-te-combo");
  if (!select) { setTimeout(() => doGTranslate(code), 300); return; }
  select.value = code;
  select.dispatchEvent(new Event("change"));
}

const roleColors: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  MANAGER: "bg-blue-100 text-blue-700",
  RECEPTIONIST: "bg-green-100 text-green-700",
  ACCOUNTANT: "bg-orange-100 text-orange-700",
};

export function Header({ title }: { title?: string }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const user = session?.user as { name?: string; email?: string; role?: string } | undefined;
  const initials = user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "??";
  const [activeLang, setActiveLang] = useState("en");
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">
      {/* Left: hamburger (mobile) + title */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button type="button" className="md:hidden p-1 rounded-md hover:bg-muted outline-none" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-56 p-0 flex flex-col">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            {/* Logo */}
            <div className="h-14 flex items-center gap-2.5 px-4 border-b shrink-0">
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
                    onClick={() => setSheetOpen(false)}
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
          </SheetContent>
        </Sheet>

        <h1 className="text-base font-semibold text-foreground">{title ?? "VenueFlow"}</h1>
      </div>

      {/* Right: lang + role + user */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Language selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground outline-none transition-colors">
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline">{LANGS.find((l) => l.code === activeLang)?.native}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            {LANGS.map((lang) => (
              <DropdownMenuItem
                key={lang.code}
                className={`gap-2 cursor-pointer ${activeLang === lang.code ? "font-semibold" : ""}`}
                onClick={() => { doGTranslate(lang.code); setActiveLang(lang.code); }}
              >
                <span className="w-5 text-center">{lang.native}</span>
                {lang.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {user?.role && (
          <span className={`hidden sm:inline text-xs font-medium px-2 py-0.5 rounded-full ${roleColors[user.role] ?? ""}`}>
            {user.role}
          </span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="outline-none">
              <Avatar className="h-8 w-8 cursor-pointer">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
              {user?.role && (
                <span className={`sm:hidden mt-1 inline-block text-xs font-medium px-2 py-0.5 rounded-full ${roleColors[user.role] ?? ""}`}>
                  {user.role}
                </span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile" className="gap-2 cursor-pointer flex items-center">
                <User className="h-4 w-4" /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 cursor-pointer text-destructive focus:text-destructive"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
