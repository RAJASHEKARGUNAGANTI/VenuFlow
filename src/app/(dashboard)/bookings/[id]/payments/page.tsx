"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft, Plus, CreditCard, CheckCircle, Banknote, Smartphone,
  Building2, FileCheck, User, Calendar, Users, FileText, IndianRupee,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PaymentMode, PaymentPurpose } from "@prisma/client";

// ── Types ────────────────────────────────────────────────────────────────────

interface Payment {
  id: string;
  amount: number;
  mode: PaymentMode;
  purpose: PaymentPurpose;
  isRefund: boolean;
  transactionRef: string | null;
  metadata: Record<string, string> | null;
  notes: string | null;
  receivedAt: string;
  receivedBy: { name: string };
}

interface Booking {
  id: string;
  bookingNumber: string;
  eventType: string;
  timeSlot: string;
  startDate: string;
  endDate: string;
  guestCount: number;
  status: string;
  baseAmount: number;
  amenityTotal: number;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  notes: string | null;
  client: { name: string; phone: string; email: string | null };
  hall: { name: string; venue: { name: string } };
  createdBy: { name: string } | null;
  payments: Payment[];
}

// ── Labels / Icons ───────────────────────────────────────────────────────────

const modeLabels: Record<PaymentMode, string> = {
  CASH: "Cash", UPI: "UPI", BANK_TRANSFER: "Bank / Net Banking",
  CHEQUE: "Cheque", CARD: "Debit / Credit Card",
};
const modeIcons: Record<PaymentMode, React.ReactNode> = {
  CASH: <Banknote className="h-4 w-4" />,
  UPI: <Smartphone className="h-4 w-4" />,
  BANK_TRANSFER: <Building2 className="h-4 w-4" />,
  CHEQUE: <FileCheck className="h-4 w-4" />,
  CARD: <CreditCard className="h-4 w-4" />,
};
const purposeLabels: Record<PaymentPurpose, string> = {
  ADVANCE_DEPOSIT: "Advance Deposit",
  INSTALLMENT: "Partial / Installment",
  AMENITY_ADDITION: "Amenity Addition",
  FINAL_SETTLEMENT: "Final Settlement",
  REFUND: "Refund",
};
const statusColors: Record<string, string> = {
  ENQUIRY: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

// ── Form Schema ──────────────────────────────────────────────────────────────

const schema = z.object({
  amount: z.preprocess((v) => Number(v), z.number().positive("Amount must be positive")),
  mode: z.nativeEnum(PaymentMode),
  purpose: z.nativeEnum(PaymentPurpose),
  isRefund: z.boolean().optional().default(false),
  notes: z.string().optional(),
  upiId: z.string().optional(), utr: z.string().optional(),
  cardType: z.string().optional(), last4: z.string().max(4).optional(), authCode: z.string().optional(),
  transferType: z.string().optional(), bankName: z.string().optional(), bankRef: z.string().optional(),
  chequeNumber: z.string().optional(), chequeBank: z.string().optional(), chequeDate: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

function buildMetadata(mode: PaymentMode, d: FormData): Record<string, string> | null {
  const pick = (...pairs: [string, string | undefined][]) => {
    const m: Record<string, string> = {};
    pairs.forEach(([k, v]) => { if (v) m[k] = v; });
    return Object.keys(m).length ? m : null;
  };
  if (mode === PaymentMode.UPI) return pick(["upiId", d.upiId], ["utr", d.utr]);
  if (mode === PaymentMode.CARD) return pick(["cardType", d.cardType], ["last4", d.last4], ["authCode", d.authCode]);
  if (mode === PaymentMode.BANK_TRANSFER) return pick(["transferType", d.transferType], ["bankName", d.bankName], ["bankRef", d.bankRef]);
  if (mode === PaymentMode.CHEQUE) return pick(["chequeNumber", d.chequeNumber], ["chequeBank", d.chequeBank], ["chequeDate", d.chequeDate]);
  return null;
}

function metaSummary(mode: PaymentMode, meta: Record<string, string>): string {
  const parts: string[] = [];
  if (mode === PaymentMode.UPI) {
    if (meta.upiId) parts.push(`UPI: ${meta.upiId}`);
    if (meta.utr) parts.push(`UTR: ${meta.utr}`);
  } else if (mode === PaymentMode.CARD) {
    if (meta.cardType) parts.push(meta.cardType);
    if (meta.last4) parts.push(`****${meta.last4}`);
    if (meta.authCode) parts.push(`Auth: ${meta.authCode}`);
  } else if (mode === PaymentMode.BANK_TRANSFER) {
    if (meta.transferType) parts.push(meta.transferType);
    if (meta.bankName) parts.push(meta.bankName);
    if (meta.bankRef) parts.push(`Ref: ${meta.bankRef}`);
  } else if (mode === PaymentMode.CHEQUE) {
    if (meta.chequeNumber) parts.push(`Cheque #${meta.chequeNumber}`);
    if (meta.chequeBank) parts.push(meta.chequeBank);
    if (meta.chequeDate) parts.push(meta.chequeDate);
  }
  return parts.join(" · ");
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BookingPaymentsPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: booking, isLoading } = useQuery<Booking>({
    queryKey: ["booking", id],
    queryFn: () => fetch(`/api/bookings/${id}`).then((r) => r.json()),
  });

  const { register, handleSubmit, control, reset, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: { mode: PaymentMode.CASH, purpose: PaymentPurpose.INSTALLMENT, isRefund: false },
  });

  const selectedMode = watch("mode");
  const isRefund = watch("isRefund");
  const enteredAmount = watch("amount");

  const addPayment = useMutation({
    mutationFn: async (data: FormData) => {
      const metadata = buildMetadata(data.mode, data);
      const r = await fetch(`/api/bookings/${id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: data.amount, mode: data.mode, purpose: data.purpose,
          isRefund: data.isRefund, notes: data.notes, metadata,
          transactionRef: data.utr || data.bankRef || data.chequeNumber || data.authCode || undefined,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json?.error ?? "Failed");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking", id] });
      setDialogOpen(false);
      reset();
      toast({ title: "Payment recorded" });
    },
    onError: () => toast({ title: "Failed to record payment", variant: "destructive" }),
  });

  if (isLoading) return <div className="text-muted-foreground text-sm p-6">Loading...</div>;
  if (!booking || (booking as { error?: string }).error) return <div className="text-destructive p-6">Booking not found</div>;

  const payments = booking.payments ?? [];
  const totalPaid = payments.filter((p) => !p.isRefund).reduce((s, p) => s + p.amount, 0);
  const totalRefunded = payments.filter((p) => p.isRefund).reduce((s, p) => s + p.amount, 0);
  const netPaid = totalPaid - totalRefunded;
  const paidPct = booking.grandTotal > 0 ? Math.min(100, (netPaid / booking.grandTotal) * 100) : 0;

  return (
    <div className="space-y-5 max-w-4xl">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href={`/bookings/${id}`}>
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to Booking
            </Button>
          </Link>
          <div>
            <h2 className="text-xl font-semibold">Payment History</h2>
            <p className="text-sm text-muted-foreground">#{booking.bookingNumber.slice(-8)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/bookings/${id}/invoice`}>
            <Button variant="outline" size="sm" className="gap-2">
              <FileText className="h-4 w-4" /> View Invoice
            </Button>
          </Link>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[booking.status] ?? ""}`}>
            {booking.status.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* ── Booking summary ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <User className="h-3.5 w-3.5" /><span className="text-xs">Client</span>
            </div>
            <p className="font-medium text-sm">{booking.client.name}</p>
            <p className="text-xs text-muted-foreground">{booking.client.phone}</p>
            {booking.client.email && <p className="text-xs text-muted-foreground">{booking.client.email}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Building2 className="h-3.5 w-3.5" /><span className="text-xs">Hall / Venue</span>
            </div>
            <p className="font-medium text-sm">{booking.hall.name}</p>
            <p className="text-xs text-muted-foreground">{booking.hall.venue.name}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-3.5 w-3.5" /><span className="text-xs">Event</span>
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

      {/* ── Financial summary ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <IndianRupee className="h-4 w-4" /> Financial Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-muted/40 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Base Amount</p>
              <p className="font-semibold">{formatCurrency(booking.baseAmount)}</p>
            </div>
            <div className="p-3 bg-muted/40 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Amenities</p>
              <p className="font-semibold">{formatCurrency(booking.amenityTotal)}</p>
            </div>
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Grand Total</p>
              <p className="font-bold text-lg">{formatCurrency(booking.grandTotal)}</p>
            </div>
            <div className={`p-3 rounded-lg ${booking.balanceAmount > 0 ? "bg-orange-50 border border-orange-200" : "bg-green-50 border border-green-200"}`}>
              <p className="text-xs text-muted-foreground mb-1">Balance Due</p>
              <p className={`font-bold text-lg ${booking.balanceAmount > 0 ? "text-orange-600" : "text-green-600"}`}>
                {formatCurrency(booking.balanceAmount)}
              </p>
            </div>
          </div>

          {/* Payment progress bar */}
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Payment progress</span>
              <span>{paidPct.toFixed(0)}% paid ({formatCurrency(netPaid)} of {formatCurrency(booking.grandTotal)})</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${paidPct >= 100 ? "bg-green-500" : "bg-primary"}`}
                style={{ width: `${paidPct}%` }}
              />
            </div>
          </div>

          {/* Quick stats row */}
          <div className="flex flex-wrap gap-3 pt-1 text-sm border-t">
            <span className="flex items-center gap-1.5 text-green-700">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Paid: <strong>{formatCurrency(totalPaid)}</strong>
            </span>
            {totalRefunded > 0 && (
              <span className="flex items-center gap-1.5 text-red-600">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                Refunded: <strong>{formatCurrency(totalRefunded)}</strong>
              </span>
            )}
            <span className="flex items-center gap-1.5 text-muted-foreground">
              Net paid: <strong className="text-foreground">{formatCurrency(netPaid)}</strong>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Payment transactions ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Transactions ({payments.length})
            </CardTitle>
            {booking.status !== "CANCELLED" && booking.status !== "COMPLETED" && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" /> Record Payment
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Record Payment</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit((d: FormData) => addPayment.mutate(d))} className="space-y-4 pt-1">
                    {/* Amount */}
                    <div className="space-y-1">
                      <Label>Amount (₹) *</Label>
                      <div className="relative">
                        <Input
                          type="number" step="0.01"
                          placeholder={booking.balanceAmount > 0 ? `Full balance: ${booking.balanceAmount}` : "0.00"}
                          {...register("amount")}
                        />
                        {booking.balanceAmount > 0 && enteredAmount > 0 && Number(enteredAmount) < booking.balanceAmount && (
                          <span className="absolute right-3 top-2 text-xs text-orange-600 font-medium">Partial</span>
                        )}
                        {booking.balanceAmount > 0 && Number(enteredAmount) >= booking.balanceAmount && (
                          <span className="absolute right-3 top-2 text-xs text-green-600 font-medium">Full</span>
                        )}
                      </div>
                      {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
                      {booking.balanceAmount > 0 && !isRefund && (
                        <p className="text-xs text-muted-foreground">
                          Outstanding: <span className="font-medium text-orange-600">{formatCurrency(booking.balanceAmount)}</span>
                        </p>
                      )}
                    </div>

                    {/* Mode + Purpose */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Payment Mode *</Label>
                        <Controller name="mode" control={control} render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(modeLabels).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )} />
                      </div>
                      <div className="space-y-1">
                        <Label>Purpose *</Label>
                        <Controller name="purpose" control={control} render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(purposeLabels).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )} />
                      </div>
                    </div>

                    {/* Mode-specific fields */}
                    {selectedMode === PaymentMode.UPI && (
                      <div className="space-y-3 p-3 bg-muted/40 rounded-md">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">UPI Details</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1"><Label className="text-xs">Payer UPI ID</Label><Input placeholder="name@upi" {...register("upiId")} /></div>
                          <div className="space-y-1"><Label className="text-xs">UTR / Transaction ID</Label><Input placeholder="12-digit UTR" {...register("utr")} /></div>
                        </div>
                      </div>
                    )}
                    {selectedMode === PaymentMode.CARD && (
                      <div className="space-y-3 p-3 bg-muted/40 rounded-md">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Card Details</p>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1"><Label className="text-xs">Card Type</Label>
                            <Controller name="cardType" control={control} render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent><SelectItem value="DEBIT">Debit</SelectItem><SelectItem value="CREDIT">Credit</SelectItem></SelectContent>
                              </Select>
                            )} />
                          </div>
                          <div className="space-y-1"><Label className="text-xs">Last 4 Digits</Label><Input placeholder="1234" maxLength={4} {...register("last4")} /></div>
                          <div className="space-y-1"><Label className="text-xs">Auth Code</Label><Input placeholder="Auth #" {...register("authCode")} /></div>
                        </div>
                      </div>
                    )}
                    {selectedMode === PaymentMode.BANK_TRANSFER && (
                      <div className="space-y-3 p-3 bg-muted/40 rounded-md">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bank Transfer Details</p>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1"><Label className="text-xs">Transfer Type</Label>
                            <Controller name="transferType" control={control} render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder="NEFT/RTGS" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="NEFT">NEFT</SelectItem><SelectItem value="RTGS">RTGS</SelectItem>
                                  <SelectItem value="IMPS">IMPS</SelectItem><SelectItem value="NET_BANKING">Net Banking</SelectItem>
                                </SelectContent>
                              </Select>
                            )} />
                          </div>
                          <div className="space-y-1"><Label className="text-xs">Bank Name</Label><Input placeholder="SBI, HDFC..." {...register("bankName")} /></div>
                          <div className="space-y-1"><Label className="text-xs">UTR / Ref Number</Label><Input placeholder="Reference #" {...register("bankRef")} /></div>
                        </div>
                      </div>
                    )}
                    {selectedMode === PaymentMode.CHEQUE && (
                      <div className="space-y-3 p-3 bg-muted/40 rounded-md">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cheque Details</p>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1"><Label className="text-xs">Cheque Number</Label><Input placeholder="123456" {...register("chequeNumber")} /></div>
                          <div className="space-y-1"><Label className="text-xs">Bank Name</Label><Input placeholder="Bank name" {...register("chequeBank")} /></div>
                          <div className="space-y-1"><Label className="text-xs">Cheque Date</Label><Input type="date" {...register("chequeDate")} /></div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label>Notes</Label>
                      <Textarea placeholder="Any additional info..." {...register("notes")} rows={2} />
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="isRefund" {...register("isRefund")} className="h-4 w-4" />
                      <Label htmlFor="isRefund" className="font-normal cursor-pointer text-sm">This is a refund</Label>
                    </div>
                    <Button type="submit" className="w-full" disabled={addPayment.isPending}>
                      {addPayment.isPending ? "Recording..." : "Record Payment"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="py-10 text-center">
              <CreditCard className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No payments recorded yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((p, idx) => {
                const meta = p.metadata as Record<string, string> | null;
                const summary = meta ? metaSummary(p.mode, meta) : null;
                return (
                  <div
                    key={p.id}
                    className={`rounded-lg border p-4 ${p.isRefund ? "bg-red-50 border-red-100" : "bg-card"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        {/* Icon */}
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${p.isRefund ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>
                          {modeIcons[p.mode]}
                        </div>
                        {/* Details */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold">{purposeLabels[p.purpose]}</p>
                            <Badge variant="outline" className="text-xs font-normal">{modeLabels[p.mode]}</Badge>
                            {p.isRefund && <Badge variant="destructive" className="text-xs">Refund</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(p.receivedAt)} · Received by {p.receivedBy.name}
                          </p>
                          {summary && (
                            <p className="text-xs text-muted-foreground mt-1 font-mono bg-muted/60 px-2 py-0.5 rounded inline-block">
                              {summary}
                            </p>
                          )}
                          {p.transactionRef && !summary && (
                            <p className="text-xs text-muted-foreground mt-1 font-mono bg-muted/60 px-2 py-0.5 rounded inline-block">
                              Ref: {p.transactionRef}
                            </p>
                          )}
                          {p.notes && (
                            <p className="text-xs text-muted-foreground italic mt-1">{p.notes}</p>
                          )}
                        </div>
                      </div>
                      {/* Amount + index */}
                      <div className="text-right shrink-0">
                        <p className={`font-bold text-lg ${p.isRefund ? "text-red-600" : "text-green-700"}`}>
                          {p.isRefund ? "−" : "+"}{formatCurrency(p.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">#{idx + 1}</p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Running totals */}
              <div className="mt-4 pt-4 border-t space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total collected</span>
                  <span className="font-semibold text-green-700">{formatCurrency(totalPaid)}</span>
                </div>
                {totalRefunded > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total refunded</span>
                    <span className="font-semibold text-red-600">−{formatCurrency(totalRefunded)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2">
                  <span className="font-medium">Net paid</span>
                  <span className="font-bold">{formatCurrency(netPaid)}</span>
                </div>
                {booking.balanceAmount > 0 ? (
                  <div className="flex justify-between bg-orange-50 border border-orange-200 rounded-md px-3 py-2">
                    <span className="font-medium text-orange-700">Balance due</span>
                    <span className="font-bold text-orange-700">{formatCurrency(booking.balanceAmount)}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">Fully settled</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
