"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { User, Mail, Lock, ShieldCheck, Eye, EyeOff, Save } from "lucide-react";

// ── Schemas ───────────────────────────────────────────────────────────────────

const infoSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
});
type InfoForm = z.infer<typeof infoSchema>;

const pwSchema = z.object({
  currentPassword: z.string().min(1, "Required"),
  newPassword: z.string().min(8, "Minimum 8 characters"),
  confirmPassword: z.string().min(1, "Required"),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});
type PwForm = z.infer<typeof pwSchema>;

const roleColors: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  MANAGER: "bg-blue-100 text-blue-700",
  RECEPTIONIST: "bg-green-100 text-green-700",
  ACCOUNTANT: "bg-orange-100 text-orange-700",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { data: session, update: updateSession } = useSession();
  const user = session?.user as { name?: string; email?: string; role?: string } | undefined;
  const { toast } = useToast();

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [infoLoading, setInfoLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  // ── Info form ─────────────────────────────────────────────────────────────

  const {
    register: regInfo,
    handleSubmit: handleInfo,
    reset: resetInfo,
    formState: { errors: infoErrors, isDirty: infoDirty },
  } = useForm<InfoForm>({
    resolver: zodResolver(infoSchema),
    defaultValues: { name: "", email: "" },
  });

  useEffect(() => {
    if (user) resetInfo({ name: user.name ?? "", email: user.email ?? "" });
  }, [user, resetInfo]);

  const saveInfo = async (data: InfoForm) => {
    setInfoLoading(true);
    try {
      const r = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await r.json();
      if (!r.ok) {
        const msg = typeof json.error === "object"
          ? Object.values(json.error).flat().join(", ")
          : json.error;
        toast({ title: msg, variant: "destructive" });
        return;
      }
      // Update session so header reflects new name/email immediately
      await updateSession({ name: json.name, email: json.email });
      toast({ title: "Profile updated successfully" });
      resetInfo({ name: json.name, email: json.email });
    } finally {
      setInfoLoading(false);
    }
  };

  // ── Password form ─────────────────────────────────────────────────────────

  const {
    register: regPw,
    handleSubmit: handlePw,
    reset: resetPw,
    formState: { errors: pwErrors },
  } = useForm<PwForm>({ resolver: zodResolver(pwSchema) });

  const savePassword = async (data: PwForm) => {
    setPwLoading(true);
    try {
      const r = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: user?.name ?? "",
          email: user?.email ?? "",
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });
      const json = await r.json();
      if (!r.ok) {
        const msg = typeof json.error === "object"
          ? Object.values(json.error).flat().join(", ")
          : json.error;
        toast({ title: msg, variant: "destructive" });
        return;
      }
      toast({ title: "Password changed successfully" });
      resetPw();
    } finally {
      setPwLoading(false);
    }
  };

  const initials = user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "??";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold">My Profile</h2>
        <p className="text-sm text-muted-foreground">Manage your account information and password</p>
      </div>

      {/* ── Identity card ── */}
      <Card>
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold shrink-0">
              {initials}
            </div>
            <div>
              <p className="font-semibold text-lg">{user?.name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              {user?.role && (
                <span className={`mt-1 inline-block text-xs font-medium px-2.5 py-0.5 rounded-full ${roleColors[user.role] ?? ""}`}>
                  {user.role}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Edit info ── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4" /> Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInfo(saveInfo)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="name" className="pl-9" placeholder="Your full name" {...regInfo("name")} />
              </div>
              {infoErrors.name && <p className="text-xs text-destructive">{infoErrors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" className="pl-9" placeholder="your@email.com" {...regInfo("email")} />
              </div>
              {infoErrors.email && <p className="text-xs text-destructive">{infoErrors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Role</Label>
              <div className="flex items-center gap-2 h-9 px-3 border rounded-md bg-muted/40 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4" />
                {user?.role ?? "—"}
                <span className="text-xs ml-1">(contact admin to change)</span>
              </div>
            </div>

            <Button type="submit" size="sm" className="gap-2" disabled={infoLoading || !infoDirty}>
              <Save className="h-4 w-4" />
              {infoLoading ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Change password ── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lock className="h-4 w-4" /> Change Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePw(savePassword)} className="space-y-4">
            {/* Current password */}
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="currentPassword"
                  type={showCurrent ? "text" : "password"}
                  className="pl-9 pr-9"
                  placeholder="Enter current password"
                  {...regPw("currentPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {pwErrors.currentPassword && <p className="text-xs text-destructive">{pwErrors.currentPassword.message}</p>}
            </div>

            {/* New password */}
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="newPassword"
                  type={showNew ? "text" : "password"}
                  className="pl-9 pr-9"
                  placeholder="Minimum 6 characters"
                  {...regPw("newPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {pwErrors.newPassword && <p className="text-xs text-destructive">{pwErrors.newPassword.message}</p>}
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  className="pl-9 pr-9"
                  placeholder="Re-enter new password"
                  {...regPw("confirmPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {pwErrors.confirmPassword && <p className="text-xs text-destructive">{pwErrors.confirmPassword.message}</p>}
            </div>

            <Button type="submit" size="sm" variant="outline" className="gap-2" disabled={pwLoading}>
              <Lock className="h-4 w-4" />
              {pwLoading ? "Updating..." : "Change Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
