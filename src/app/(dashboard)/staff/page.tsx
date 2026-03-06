"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const schema = z.object({
  name: z.string().min(1, "Required"),
  phone: z.string().min(1, "Required"),
  email: z.string().email().optional().or(z.literal("")),
  role: z.string().min(1, "Required"),
  salary: z.preprocess((v) => v === "" || v == null ? undefined : Number(v), z.number().optional()),
  venueId: z.string().min(1, "Required"),
});
type FormData = z.infer<typeof schema>;

const staffRoles = ["Manager", "Coordinator", "Cook", "Waiter", "Security", "Cleaner", "Driver", "Other"];

export default function StaffPage() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: () => fetch("/api/staff").then((r) => r.json()),
  });

  const { data: venues = [] } = useQuery({
    queryKey: ["venues"],
    queryFn: () => fetch("/api/venues").then((r) => r.json()),
  });

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
  });

  const createStaff = useMutation({
    mutationFn: (data: FormData) =>
      fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      setOpen(false);
      reset();
      toast({ title: "Staff member added" });
    },
    onError: () => toast({ title: "Failed to add staff", variant: "destructive" }),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Staff</h2>
          <p className="text-sm text-muted-foreground">{staff.length} staff members</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Add Staff</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Staff Member</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit((d: FormData) => createStaff.mutate(d))} className="space-y-4">
              <div className="space-y-1">
                <Label>Name *</Label>
                <Input placeholder="Staff name" {...register("name")} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Phone *</Label>
                  <Input placeholder="Phone number" {...register("phone")} />
                  {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input placeholder="email@example.com" {...register("email")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Role *</Label>
                  <Controller name="role" control={control} render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                      <SelectContent>
                        {staffRoles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                  {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Salary (₹/month)</Label>
                  <Input type="number" placeholder="15000" {...register("salary")} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Venue *</Label>
                <Controller name="venueId" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue placeholder="Select venue" /></SelectTrigger>
                    <SelectContent>
                      {venues.map((v: { id: string; name: string }) => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )} />
                {errors.venueId && <p className="text-xs text-destructive">{errors.venueId.message}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={createStaff.isPending}>
                {createStaff.isPending ? "Adding..." : "Add Staff Member"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Venue</TableHead>
              <TableHead>Salary</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                </TableRow>
              ))
            ) : staff.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No staff yet</TableCell></TableRow>
            ) : (
              staff.map((s: { id: string; name: string; role: string; phone: string; email: string | null; salary: number | null; venue: { name: string } }) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.role}</TableCell>
                  <TableCell>{s.phone}</TableCell>
                  <TableCell className="text-muted-foreground">{s.email ?? "—"}</TableCell>
                  <TableCell>{s.venue.name}</TableCell>
                  <TableCell>{s.salary ? `₹${s.salary.toLocaleString("en-IN")}` : "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
