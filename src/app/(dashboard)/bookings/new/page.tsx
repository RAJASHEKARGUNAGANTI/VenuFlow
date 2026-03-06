"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";

const schema = z.object({
  hallId: z.string().min(1, "Select a hall"),
  clientId: z.string().min(1, "Select a client"),
  eventType: z.string().min(1, "Select event type"),
  startDate: z.string().min(1, "Select start date"),
  endDate: z.string().min(1, "Select end date"),
  timeSlot: z.string().min(1, "Select time slot"),
  guestCount: z.preprocess((v) => Number(v), z.number().int().positive("Enter guest count")),
  baseAmount: z.preprocess((v) => Number(v), z.number().min(0, "Enter base amount")),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function NewBookingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [conflictError, setConflictError] = useState<string | null>(null);

  const { data: halls = [] } = useQuery({
    queryKey: ["halls"],
    queryFn: () => fetch("/api/halls").then((r) => r.json()),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => fetch("/api/clients").then((r) => r.json()),
  });

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: { guestCount: 100, baseAmount: 0 },
  });

  const selectedHallId = watch("hallId");
  const selectedHall = halls.find((h: { id: string; basePrice: number }) => h.id === selectedHallId);

  const createBooking = useMutation({
    mutationFn: (data: FormData) =>
      fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          startDate: new Date(data.startDate).toISOString(),
          endDate: new Date(data.endDate).toISOString(),
        }),
      }).then(async (r) => {
        if (r.status === 409) {
          const err = await r.json();
          throw new Error(err.error);
        }
        if (!r.ok) throw new Error("Failed to create booking");
        return r.json();
      }),
    onSuccess: (booking) => {
      toast({ title: "Booking created successfully!" });
      router.push(`/bookings/${booking.id}`);
    },
    onError: (err: Error) => {
      if (err.message.includes("already booked")) {
        setConflictError(err.message);
      } else {
        toast({ title: err.message, variant: "destructive" });
      }
    },
  });

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/bookings"><Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
        <div>
          <h2 className="text-xl font-semibold">New Booking</h2>
          <p className="text-sm text-muted-foreground">Create a new hall booking</p>
        </div>
      </div>

      {conflictError && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-md text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {conflictError}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Booking Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((d: FormData) => { setConflictError(null); createBooking.mutate(d); })} className="space-y-4">
            {/* Hall */}
            <div className="space-y-1">
              <Label>Hall *</Label>
              <Controller name="hallId" control={control} render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="Select a hall" /></SelectTrigger>
                  <SelectContent>
                    {halls.map((h: { id: string; name: string; venue: { name: string }; capacity: number; basePrice: number }) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.name} — {h.venue?.name} (Cap: {h.capacity}, ₹{h.basePrice.toLocaleString("en-IN")})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
              {errors.hallId && <p className="text-xs text-destructive">{errors.hallId.message}</p>}
            </div>

            {/* Client */}
            <div className="space-y-1">
              <Label>Client *</Label>
              <Controller name="clientId" control={control} render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c: { id: string; name: string; phone: string }) => (
                      <SelectItem key={c.id} value={c.id}>{c.name} — {c.phone}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
              {errors.clientId && <p className="text-xs text-destructive">{errors.clientId.message}</p>}
              <p className="text-xs text-muted-foreground">
                <Link href="/clients" className="underline">Manage clients</Link>
              </p>
            </div>

            {/* Event Type */}
            <div className="space-y-1">
              <Label>Event Type *</Label>
              <Controller name="eventType" control={control} render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="Select event type" /></SelectTrigger>
                  <SelectContent>
                    {["WEDDING","BIRTHDAY","CORPORATE","RECEPTION","CONFERENCE","SOCIAL","OTHER"].map((t) => (
                      <SelectItem key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
              {errors.eventType && <p className="text-xs text-destructive">{errors.eventType.message}</p>}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Start Date *</Label>
                <Input type="date" {...register("startDate")} />
                {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>End Date *</Label>
                <Input type="date" {...register("endDate")} />
                {errors.endDate && <p className="text-xs text-destructive">{errors.endDate.message}</p>}
              </div>
            </div>

            {/* Time Slot */}
            <div className="space-y-1">
              <Label>Time Slot *</Label>
              <Controller name="timeSlot" control={control} render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="Select time slot" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MORNING">Morning (6am – 2pm)</SelectItem>
                    <SelectItem value="EVENING">Evening (4pm – 12am)</SelectItem>
                    <SelectItem value="FULL_DAY">Full Day</SelectItem>
                  </SelectContent>
                </Select>
              )} />
              {errors.timeSlot && <p className="text-xs text-destructive">{errors.timeSlot.message}</p>}
            </div>

            {/* Guest Count & Amount */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Guest Count *</Label>
                <Input type="number" {...register("guestCount")} />
                {errors.guestCount && <p className="text-xs text-destructive">{errors.guestCount.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Base Amount (₹) *</Label>
                <Input type="number" placeholder={selectedHall ? String(selectedHall.basePrice) : "0"} {...register("baseAmount")} />
                {errors.baseAmount && <p className="text-xs text-destructive">{errors.baseAmount.message}</p>}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea placeholder="Special requirements, instructions..." {...register("notes")} />
            </div>

            <Button type="submit" className="w-full" disabled={createBooking.isPending}>
              {createBooking.isPending ? "Creating Booking..." : "Create Booking"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
