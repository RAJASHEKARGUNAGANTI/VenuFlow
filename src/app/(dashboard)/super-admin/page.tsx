"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShieldCheck, Users, TrendingUp, CalendarCheck, Plus, ToggleLeft, ToggleRight, Building2, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface Admin {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  venue: { id: string; name: string } | null;
  bookings: number;
  revenue: number;
}

interface Venue {
  id: string;
  name: string;
}

const createSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "At least 8 characters"),
});
type FormData = z.infer<typeof createSchema>;

const assignVenueSchema = z.object({
  venueId: z.string().min(1, "Venue is required"),
});
type AssignVenueData = z.infer<typeof assignVenueSchema>;

export default function SuperAdminPage() {
  const [open, setOpen] = useState(false);
  const [assignVenueAdmin, setAssignVenueAdmin] = useState<Admin | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: session, status } = useSession();
  const router = useRouter();

  const isSuperAdmin = status !== "loading" && (session?.user as { role?: string } | undefined)?.role === "SUPER_ADMIN";

  useEffect(() => {
    if (status === "loading") return;
    if (!isSuperAdmin) router.replace("/");
  }, [isSuperAdmin, status, router]);

  const { data: admins = [], isLoading } = useQuery<Admin[]>({
    queryKey: ["super-admin-admins"],
    queryFn: () => fetch("/api/super-admin/admins").then((r) => r.json()),
    enabled: isSuperAdmin,
  });

  const { data: venues = [] } = useQuery<Venue[]>({
    queryKey: ["venues"],
    queryFn: () => fetch("/api/venues").then((r) => r.json()),
    enabled: isSuperAdmin,
  });

  const { data: globalStats } = useQuery<{
    totalAdmins: number; activeAdmins: number; totalVenues: number;
    totalHalls: number; totalBookings: number; totalRevenue: number;
  }>({
    queryKey: ["super-admin-stats"],
    queryFn: () => fetch("/api/super-admin/stats").then((r) => r.json()),
    enabled: isSuperAdmin,
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(createSchema) as Resolver<FormData>,
  });

  const assignForm = useForm<AssignVenueData>({
    resolver: zodResolver(assignVenueSchema) as Resolver<AssignVenueData>,
  });

  const createAdmin = useMutation({
    mutationFn: (data: FormData) =>
      fetch("/api/super-admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "Failed");
        return json;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["super-admin-admins"] });
      setOpen(false);
      reset();
      toast({ title: "Admin account created" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const toggleAdmin = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetch(`/api/super-admin/admins/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["super-admin-admins"] });
      toast({ title: "Admin status updated" });
    },
  });

  const assignVenue = useMutation({
    mutationFn: ({ id, venueId }: { id: string; venueId: string }) =>
      fetch(`/api/super-admin/admins/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId }),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "Failed");
        return json;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["super-admin-admins"] });
      setAssignVenueAdmin(null);
      assignForm.reset();
      toast({ title: "Venue assigned" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  if (!isSuperAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Admin Panel
          </h2>
          <p className="text-sm text-muted-foreground">Manage admin accounts across all venues</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Create Admin</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Admin Account</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={handleSubmit((d: FormData) => createAdmin.mutate(d))}
              className="space-y-4 pt-2"
            >
              <div className="space-y-1">
                <Label>Name</Label>
                <Input {...register("name")} placeholder="Full name" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input {...register("email")} type="email" placeholder="admin@example.com" />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Password</Label>
                <Input {...register("password")} type="password" placeholder="Min. 6 characters" />
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => { setOpen(false); reset(); }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || createAdmin.isPending}>
                  {isSubmitting || createAdmin.isPending ? "Creating..." : "Create Admin"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {!globalStats ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-5 pb-5"><Skeleton className="h-3 w-24 mb-3" /><Skeleton className="h-7 w-28" /></CardContent></Card>
          ))
        ) : (
          [
            { label: "Total Admins",   value: globalStats.totalAdmins,   icon: Users,        color: "text-blue-600" },
            { label: "Active Admins",  value: globalStats.activeAdmins,  icon: ShieldCheck,  color: "text-green-600" },
            { label: "Total Venues",   value: globalStats.totalVenues,   icon: Building2,    color: "text-indigo-600" },
            { label: "Total Halls",    value: globalStats.totalHalls,    icon: BookOpen,     color: "text-cyan-600" },
            { label: "Total Bookings", value: globalStats.totalBookings, icon: CalendarCheck,color: "text-orange-600" },
            { label: "Total Revenue",  value: formatCurrency(globalStats.totalRevenue), icon: TrendingUp, color: "text-purple-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Admins Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Admin Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Venue</TableHead>
                  <TableHead className="text-right">Bookings</TableHead><TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-center">Status</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-5 w-16 rounded-full mx-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-7 w-24 ml-auto rounded-md" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : admins.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No admin accounts yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Venue</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">{admin.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{admin.email}</TableCell>
                    <TableCell className="text-sm">
                      {admin.venue ? admin.venue.name : (
                        <span className="text-orange-500 italic text-xs">No venue — assign one</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">{admin.bookings}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(admin.revenue)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={admin.isActive ? "default" : "secondary"}>
                        {admin.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!admin.venue && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1.5 text-xs"
                            onClick={() => {
                              setAssignVenueAdmin(admin);
                              assignForm.reset();
                            }}
                          >
                            <Building2 className="h-3.5 w-3.5" /> Assign Venue
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1.5 text-xs"
                          onClick={() => toggleAdmin.mutate({ id: admin.id, isActive: !admin.isActive })}
                          disabled={toggleAdmin.isPending}
                        >
                          {admin.isActive
                            ? <><ToggleLeft className="h-3.5 w-3.5 text-red-500" /> Deactivate</>
                            : <><ToggleRight className="h-3.5 w-3.5 text-green-500" /> Activate</>
                          }
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Assign Venue Dialog */}
      <Dialog open={!!assignVenueAdmin} onOpenChange={(o) => { if (!o) { setAssignVenueAdmin(null); assignForm.reset(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Venue — {assignVenueAdmin?.name}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={assignForm.handleSubmit((d: AssignVenueData) =>
              assignVenue.mutate({ id: assignVenueAdmin!.id, venueId: d.venueId })
            )}
            className="space-y-4 pt-2"
          >
            <div className="space-y-1">
              <Label>Venue <span className="text-destructive">*</span></Label>
              <Controller
                name="venueId"
                control={assignForm.control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a venue" />
                    </SelectTrigger>
                    <SelectContent>
                      {venues.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {assignForm.formState.errors.venueId && (
                <p className="text-xs text-destructive">{assignForm.formState.errors.venueId.message}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => { setAssignVenueAdmin(null); assignForm.reset(); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={assignVenue.isPending}>
                {assignVenue.isPending ? "Assigning..." : "Assign Venue"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
