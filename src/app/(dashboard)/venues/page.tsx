"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
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
import { Skeleton } from "@/components/ui/skeleton";

const schema = z.object({
  name: z.string().min(2, "Venue name must be at least 2 characters"),
  address: z.string().min(5, "Enter a complete address"),
  city: z.string().min(2, "Enter a valid city name"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  email: z.string().email("Enter a valid email address").optional().or(z.literal("")),
  gstNumber: z.string().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Invalid GST number (e.g. 29ABCDE1234F1Z5)").optional().or(z.literal("")),
});
type FormData = z.infer<typeof schema>;

export default function VenuesPage() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = role === "ADMIN";

  const { data: venues = [], isLoading } = useQuery({
    queryKey: ["venues"],
    queryFn: () => fetch("/api/venues").then((r) => r.json()),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const createVenue = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await fetch("/api/venues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create venue");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["venues"] });
      setOpen(false);
      reset();
      toast({ title: "Venue created successfully" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Venues & Halls</h2>
          <p className="text-sm text-muted-foreground">Manage your venue locations</p>
        </div>
        {isAdmin && <Dialog open={open} onOpenChange={setOpen}>
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
                { name: "phone", label: "Phone", placeholder: "9876543210", inputMode: "numeric" as const, maxLength: 10 },
                { name: "email", label: "Email (optional)", placeholder: "info@venue.com" },
                { name: "gstNumber", label: "GST Number (optional)", placeholder: "36AABCU9603R1ZX" },
              ].map(({ name, label, placeholder, ...extra }) => (
                <div key={name} className="space-y-1">
                  <Label>{label}</Label>
                  <Input placeholder={placeholder} {...extra} {...register(name as keyof FormData)} />
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
        </Dialog>}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <div className="flex gap-4 pt-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
                    <a href={`tel:${venue.phone}`} className="hover:underline hover:text-primary transition-colors">
                      {venue.phone}
                    </a>
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
