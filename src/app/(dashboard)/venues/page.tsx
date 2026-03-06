"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Plus, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  name: z.string().min(1, "Required"),
  address: z.string().min(1, "Required"),
  city: z.string().min(1, "Required"),
  phone: z.string().min(1, "Required"),
  email: z.string().email().optional().or(z.literal("")),
  gstNumber: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function VenuesPage() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: venues = [], isLoading } = useQuery({
    queryKey: ["venues"],
    queryFn: () => fetch("/api/venues").then((r) => r.json()),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const createVenue = useMutation({
    mutationFn: (data: FormData) =>
      fetch("/api/venues", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["venues"] });
      setOpen(false);
      reset();
      toast({ title: "Venue created successfully" });
    },
    onError: () => toast({ title: "Failed to create venue", variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Venues & Halls</h2>
          <p className="text-sm text-muted-foreground">Manage your venue locations</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Add Venue</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Venue</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit((d) => createVenue.mutate(d))} className="space-y-4">
              {[
                { name: "name", label: "Venue Name", placeholder: "Grand Convention Centre" },
                { name: "address", label: "Address", placeholder: "123 Main Street" },
                { name: "city", label: "City", placeholder: "Hyderabad" },
                { name: "phone", label: "Phone", placeholder: "+91 98765 43210" },
                { name: "email", label: "Email (optional)", placeholder: "info@venue.com" },
                { name: "gstNumber", label: "GST Number (optional)", placeholder: "36AABCU9603R1ZX" },
              ].map(({ name, label, placeholder }) => (
                <div key={name} className="space-y-1">
                  <Label>{label}</Label>
                  <Input placeholder={placeholder} {...register(name as keyof FormData)} />
                  {errors[name as keyof FormData] && (
                    <p className="text-xs text-destructive">{errors[name as keyof FormData]?.message}</p>
                  )}
                </div>
              ))}
              <Button type="submit" className="w-full" disabled={createVenue.isPending}>
                {createVenue.isPending ? "Creating..." : "Create Venue"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : venues.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No venues yet. Add your first venue.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {venues.map((venue: {
            id: string; name: string; address: string; city: string; phone: string;
            isActive: boolean; _count?: { halls: number; clients: number };
          }) => (
            <Link key={venue.id} href={`/venues/${venue.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{venue.name}</CardTitle>
                    <Badge variant={venue.isActive ? "default" : "secondary"}>
                      {venue.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span>{venue.address}, {venue.city}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>{venue.phone}</span>
                  </div>
                  <div className="flex gap-4 pt-2">
                    <span className="text-foreground font-medium">{venue._count?.halls ?? 0} halls</span>
                    <span className="text-foreground font-medium">{venue._count?.clients ?? 0} clients</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
