"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Building2, MapPin, Phone, Mail, Receipt, Plus, Edit2, Users, IndianRupee } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

// ── Venue edit schema ──────────────────────────────────────────────────────────
const venueSchema = z.object({
  name: z.string().min(1, "Required"),
  address: z.string().min(1, "Required"),
  city: z.string().min(1, "Required"),
  phone: z.string().min(1, "Required"),
  email: z.string().email().optional().or(z.literal("")),
  gstNumber: z.string().optional(),
});
type VenueForm = z.infer<typeof venueSchema>;

// ── Hall schema ────────────────────────────────────────────────────────────────
const hallSchema = z.object({
  name: z.string().min(1, "Required"),
  capacity: z.preprocess((v) => Number(v), z.number().int().min(1, "Min 1")),
  basePrice: z.preprocess((v) => Number(v), z.number().min(0, "Min 0")),
  description: z.string().optional(),
});
type HallForm = z.infer<typeof hallSchema>;

interface Hall {
  id: string;
  name: string;
  capacity: number;
  basePrice: number;
  description?: string;
  isActive: boolean;
  _count?: { bookings: number };
}

interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  email?: string;
  gstNumber?: string;
  isActive: boolean;
  halls: Hall[];
  _count?: { clients: number; staff: number };
}

export default function VenueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [editVenueOpen, setEditVenueOpen] = useState(false);
  const [addHallOpen, setAddHallOpen] = useState(false);
  const [editHall, setEditHall] = useState<Hall | null>(null);

  const { data: venue, isLoading } = useQuery<Venue>({
    queryKey: ["venue", id],
    queryFn: () => fetch(`/api/venues/${id}`).then((r) => r.json()),
  });

  // ── Venue edit form ──────────────────────────────────────────────────────────
  const venueForm = useForm<VenueForm>({ resolver: zodResolver(venueSchema) });

  const updateVenue = useMutation({
    mutationFn: (data: VenueForm) =>
      fetch(`/api/venues/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["venue", id] });
      qc.invalidateQueries({ queryKey: ["venues"] });
      setEditVenueOpen(false);
      toast({ title: "Venue updated" });
    },
    onError: () => toast({ title: "Failed to update venue", variant: "destructive" }),
  });

  function openEditVenue() {
    if (!venue) return;
    venueForm.reset({ name: venue.name, address: venue.address, city: venue.city, phone: venue.phone, email: venue.email ?? "", gstNumber: venue.gstNumber ?? "" });
    setEditVenueOpen(true);
  }

  // ── Hall add form ────────────────────────────────────────────────────────────
  const hallForm = useForm<HallForm>({ resolver: zodResolver(hallSchema) as Resolver<HallForm> });

  const addHall = useMutation({
    mutationFn: (data: HallForm) =>
      fetch("/api/halls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, venueId: id }) }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["venue", id] });
      setAddHallOpen(false);
      hallForm.reset();
      toast({ title: "Hall added" });
    },
    onError: () => toast({ title: "Failed to add hall", variant: "destructive" }),
  });

  // ── Hall edit form ───────────────────────────────────────────────────────────
  const editHallForm = useForm<HallForm>({ resolver: zodResolver(hallSchema) as Resolver<HallForm> });

  const updateHall = useMutation({
    mutationFn: ({ hallId, data }: { hallId: string; data: HallForm }) =>
      fetch(`/api/halls/${hallId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["venue", id] });
      setEditHall(null);
      toast({ title: "Hall updated" });
    },
    onError: () => toast({ title: "Failed to update hall", variant: "destructive" }),
  });

  const toggleHall = useMutation({
    mutationFn: ({ hallId, isActive }: { hallId: string; isActive: boolean }) =>
      fetch(`/api/halls/${hallId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive }) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["venue", id] }),
    onError: () => toast({ title: "Failed to update hall", variant: "destructive" }),
  });

  function openEditHall(hall: Hall) {
    editHallForm.reset({ name: hall.name, capacity: hall.capacity, basePrice: hall.basePrice, description: hall.description ?? "" });
    setEditHall(hall);
  }

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading...</div>;
  if (!venue || (venue as { error?: string }).error) return <div className="p-4 text-destructive">Venue not found.</div>;

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Link href="/venues">
          <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h2 className="text-xl font-semibold">{venue.name}</h2>
          <p className="text-sm text-muted-foreground">{venue.city}</p>
        </div>
        <Badge variant={venue.isActive ? "default" : "secondary"} className="ml-auto">
          {venue.isActive ? "Active" : "Inactive"}
        </Badge>
      </div>

      {/* Venue info card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> Venue Details</CardTitle>
            <Dialog open={editVenueOpen} onOpenChange={setEditVenueOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2" onClick={openEditVenue}>
                  <Edit2 className="h-3.5 w-3.5" /> Edit
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Edit Venue</DialogTitle></DialogHeader>
                <form onSubmit={venueForm.handleSubmit((d: VenueForm) => updateVenue.mutate(d))} className="space-y-4">
                  {[
                    { name: "name" as const, label: "Venue Name" },
                    { name: "address" as const, label: "Address" },
                    { name: "city" as const, label: "City" },
                    { name: "phone" as const, label: "Phone" },
                    { name: "email" as const, label: "Email (optional)" },
                    { name: "gstNumber" as const, label: "GST Number (optional)" },
                  ].map(({ name, label }) => (
                    <div key={name} className="space-y-1">
                      <Label>{label}</Label>
                      <Input {...venueForm.register(name)} />
                      {venueForm.formState.errors[name] && (
                        <p className="text-xs text-destructive">{venueForm.formState.errors[name]?.message}</p>
                      )}
                    </div>
                  ))}
                  <Button type="submit" className="w-full" disabled={updateVenue.isPending}>
                    {updateVenue.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>{venue.address}, {venue.city}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span>{venue.phone}</span>
          </div>
          {venue.email && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span>{venue.email}</span>
            </div>
          )}
          {venue.gstNumber && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Receipt className="h-3.5 w-3.5 shrink-0" />
              <span>GST: {venue.gstNumber}</span>
            </div>
          )}
          <div className="flex gap-4 pt-1 col-span-full text-foreground font-medium">
            <span>{venue._count?.clients ?? 0} clients</span>
            <span>{venue._count?.staff ?? 0} staff</span>
            <span>{venue.halls.length} halls</span>
          </div>
        </CardContent>
      </Card>

      {/* Halls section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Halls</h3>
          <Dialog open={addHallOpen} onOpenChange={setAddHallOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2" onClick={() => hallForm.reset()}>
                <Plus className="h-4 w-4" /> Add Hall
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add New Hall</DialogTitle></DialogHeader>
              <form onSubmit={hallForm.handleSubmit((d: HallForm) => addHall.mutate(d))} className="space-y-4">
                <div className="space-y-1">
                  <Label>Hall Name</Label>
                  <Input placeholder="Royal Banquet Hall" {...hallForm.register("name")} />
                  {hallForm.formState.errors.name && <p className="text-xs text-destructive">{hallForm.formState.errors.name.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Capacity (guests)</Label>
                    <Input type="number" placeholder="500" {...hallForm.register("capacity")} />
                    {hallForm.formState.errors.capacity && <p className="text-xs text-destructive">{hallForm.formState.errors.capacity.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label>Base Price (₹)</Label>
                    <Input type="number" placeholder="50000" {...hallForm.register("basePrice")} />
                    {hallForm.formState.errors.basePrice && <p className="text-xs text-destructive">{hallForm.formState.errors.basePrice.message}</p>}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Description (optional)</Label>
                  <Textarea placeholder="Describe the hall..." {...hallForm.register("description")} rows={3} />
                </div>
                <Button type="submit" className="w-full" disabled={addHall.isPending}>
                  {addHall.isPending ? "Adding..." : "Add Hall"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {venue.halls.length === 0 ? (
          <Card className="text-center py-10">
            <CardContent>
              <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No halls yet. Add the first hall.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {venue.halls.map((hall) => (
              <Card key={hall.id} className={hall.isActive ? "" : "opacity-60"}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{hall.name}</CardTitle>
                    <Badge variant={hall.isActive ? "default" : "secondary"} className="shrink-0">
                      {hall.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span>{hall.capacity} guests</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <IndianRupee className="h-3.5 w-3.5" />
                      <span>{formatCurrency(hall.basePrice)}</span>
                    </div>
                  </div>
                  {hall.description && <p className="text-xs text-muted-foreground line-clamp-2">{hall.description}</p>}
                  <p className="text-xs text-muted-foreground">{hall._count?.bookings ?? 0} bookings</p>

                  <div className="flex gap-2 pt-1">
                    {/* Edit hall dialog */}
                    <Dialog open={editHall?.id === hall.id} onOpenChange={(o) => !o && setEditHall(null)}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => openEditHall(hall)}>
                          <Edit2 className="h-3.5 w-3.5" /> Edit
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Edit Hall</DialogTitle></DialogHeader>
                        <form onSubmit={editHallForm.handleSubmit((d: HallForm) => updateHall.mutate({ hallId: hall.id, data: d }))} className="space-y-4">
                          <div className="space-y-1">
                            <Label>Hall Name</Label>
                            <Input {...editHallForm.register("name")} />
                            {editHallForm.formState.errors.name && <p className="text-xs text-destructive">{editHallForm.formState.errors.name.message}</p>}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <Label>Capacity</Label>
                              <Input type="number" {...editHallForm.register("capacity")} />
                              {editHallForm.formState.errors.capacity && <p className="text-xs text-destructive">{editHallForm.formState.errors.capacity.message}</p>}
                            </div>
                            <div className="space-y-1">
                              <Label>Base Price (₹)</Label>
                              <Input type="number" {...editHallForm.register("basePrice")} />
                              {editHallForm.formState.errors.basePrice && <p className="text-xs text-destructive">{editHallForm.formState.errors.basePrice.message}</p>}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label>Description</Label>
                            <Textarea rows={3} {...editHallForm.register("description")} />
                          </div>
                          <Button type="submit" className="w-full" disabled={updateHall.isPending}>
                            {updateHall.isPending ? "Saving..." : "Save Changes"}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>

                    <Button
                      variant={hall.isActive ? "destructive" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => toggleHall.mutate({ hallId: hall.id, isActive: !hall.isActive })}
                      disabled={toggleHall.isPending}
                    >
                      {hall.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
