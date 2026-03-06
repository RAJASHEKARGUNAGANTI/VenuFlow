"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Building2, User, Calendar, Users, FileText } from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { AmenityManager } from "@/components/bookings/AmenityManager";
import { PaymentPanel } from "@/components/bookings/PaymentPanel";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const statusColors: Record<string, string> = {
  ENQUIRY: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

const nextStatuses: Record<string, string[]> = {
  ENQUIRY: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking", id],
    queryFn: () => fetch(`/api/bookings/${id}`).then((r) => r.json()),
  });

  // Same queryKey as AmenityManager — shared cache, no extra network call
  const { data: amenities = [] } = useQuery<{ id: string }[]>({
    queryKey: ["amenities", id],
    queryFn: () => fetch(`/api/bookings/${id}/amenities`).then((r) => r.json()),
    enabled: !!id,
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) =>
      fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking", id] });
      toast({ title: "Status updated" });
    },
  });

  if (isLoading) return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-20" />
        <div><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-32 mt-1" /></div>
        <Skeleton className="h-6 w-24 rounded-full ml-auto" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="pt-4 pb-4"><Skeleton className="h-3 w-16 mb-2" /><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-20 mt-1" /></CardContent></Card>
        ))}
      </div>
      <Card><CardContent className="pt-4 pb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}><Skeleton className="h-3 w-20 mx-auto mb-2" /><Skeleton className="h-5 w-24 mx-auto" /></div>
          ))}
        </div>
      </CardContent></Card>
      <div><Skeleton className="h-9 w-64 mb-4" /><Skeleton className="h-40 w-full rounded-lg" /></div>
    </div>
  );
  if (!booking || booking.error) return <div className="text-destructive">Booking not found</div>;

  const allowedNext = nextStatuses[booking.status] ?? [];

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/bookings"><Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          <div>
            <h2 className="text-xl font-semibold">Booking #{booking.bookingNumber.slice(-8)}</h2>
            <p className="text-sm text-muted-foreground">Created by {booking.createdBy?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/bookings/${id}/invoice`}>
            <Button variant="outline" size="sm" className="gap-2"><FileText className="h-4 w-4" /> Invoice</Button>
          </Link>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[booking.status]}`}>
            {booking.status.replace("_", " ")}
          </span>
          {allowedNext.length > 0 && (
            <Select onValueChange={(s) => updateStatus.mutate(s)}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue placeholder="Change status" />
              </SelectTrigger>
              <SelectContent>
                {allowedNext.map((s) => (
                  <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <User className="h-3.5 w-3.5" /><span className="text-xs">Client</span>
            </div>
            <p className="font-medium text-sm">{booking.client.name}</p>
            <p className="text-xs text-muted-foreground">{booking.client.phone}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Building2 className="h-3.5 w-3.5" /><span className="text-xs">Hall</span>
            </div>
            <p className="font-medium text-sm">{booking.hall.name}</p>
            <p className="text-xs text-muted-foreground">{booking.hall.venue.name}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-3.5 w-3.5" /><span className="text-xs">Event Date</span>
            </div>
            <p className="font-medium text-sm">{formatDate(booking.startDate)}</p>
            <p className="text-xs text-muted-foreground">{booking.timeSlot.replace("_", " ")} · {booking.eventType}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-3.5 w-3.5" /><span className="text-xs">Guests</span>
            </div>
            <p className="font-medium text-sm">{booking.guestCount}</p>
            <p className="text-xs text-muted-foreground">expected guests</p>
          </CardContent>
        </Card>
      </div>

      {/* Financials */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Base Amount</p>
              <p className="font-semibold">{formatCurrency(booking.baseAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Amenities</p>
              <p className="font-semibold">{formatCurrency(booking.amenityTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Grand Total</p>
              <p className="font-semibold text-lg">{formatCurrency(booking.grandTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Balance Due</p>
              <p className={`font-semibold text-lg ${booking.balanceAmount > 0 ? "text-orange-600" : "text-green-600"}`}>
                {formatCurrency(booking.balanceAmount)}
              </p>
            </div>
          </div>
          {booking.balanceAmount > 0 && (
            <div className="mt-3">
              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (booking.paidAmount / booking.grandTotal) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {formatCurrency(booking.paidAmount)} paid of {formatCurrency(booking.grandTotal)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="amenities">
        <TabsList>
          <TabsTrigger value="amenities">Amenities ({amenities.length})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({booking.payments?.length ?? 0})</TabsTrigger>
          {booking.notes && <TabsTrigger value="notes">Notes</TabsTrigger>}
        </TabsList>
        <TabsContent value="amenities" className="mt-4">
          <AmenityManager bookingId={id} bookingStatus={booking.status} />
        </TabsContent>
        <TabsContent value="payments" className="mt-4">
          <PaymentPanel bookingId={id} payments={booking.payments ?? []} balanceAmount={booking.balanceAmount} />
        </TabsContent>
        {booking.notes && (
          <TabsContent value="notes" className="mt-4">
            <Card><CardContent className="pt-4 text-sm">{booking.notes}</CardContent></Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
