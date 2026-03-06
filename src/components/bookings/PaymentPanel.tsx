"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, CreditCard, CheckCircle, Banknote, Smartphone, Building2, FileCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PaymentMode, PaymentPurpose } from "@prisma/client";

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

const schema = z.object({
  amount: z.preprocess((v) => Number(v), z.number().positive("Amount must be positive")),
  mode: z.nativeEnum(PaymentMode),
  purpose: z.nativeEnum(PaymentPurpose),
  isRefund: z.boolean().optional().default(false),
  notes: z.string().optional(),
  // UPI
  upiId: z.string().optional(),
  utr: z.string().optional(),
  // Card
  cardType: z.string().optional(),
  last4: z.string().max(4).optional(),
  authCode: z.string().optional(),
  // Bank Transfer
  transferType: z.string().optional(),
  bankName: z.string().optional(),
  bankRef: z.string().optional(),
  // Cheque
  chequeNumber: z.string().optional(),
  chequeBank: z.string().optional(),
  chequeDate: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const modeLabels: Record<PaymentMode, string> = {
  CASH: "Cash",
  UPI: "UPI",
  BANK_TRANSFER: "Bank / Net Banking",
  CHEQUE: "Cheque",
  CARD: "Debit / Credit Card",
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

function buildMetadata(mode: PaymentMode, d: FormData): Record<string, string> | null {
  if (mode === PaymentMode.UPI) {
    const m: Record<string, string> = {};
    if (d.upiId) m.upiId = d.upiId;
    if (d.utr) m.utr = d.utr;
    return Object.keys(m).length ? m : null;
  }
  if (mode === PaymentMode.CARD) {
    const m: Record<string, string> = {};
    if (d.cardType) m.cardType = d.cardType;
    if (d.last4) m.last4 = d.last4;
    if (d.authCode) m.authCode = d.authCode;
    return Object.keys(m).length ? m : null;
  }
  if (mode === PaymentMode.BANK_TRANSFER) {
    const m: Record<string, string> = {};
    if (d.transferType) m.transferType = d.transferType;
    if (d.bankName) m.bankName = d.bankName;
    if (d.bankRef) m.bankRef = d.bankRef;
    return Object.keys(m).length ? m : null;
  }
  if (mode === PaymentMode.CHEQUE) {
    const m: Record<string, string> = {};
    if (d.chequeNumber) m.chequeNumber = d.chequeNumber;
    if (d.chequeBank) m.chequeBank = d.chequeBank;
    if (d.chequeDate) m.chequeDate = d.chequeDate;
    return Object.keys(m).length ? m : null;
  }
  return null;
}

function metaSummary(mode: PaymentMode, meta: Record<string, string>): string {
  if (mode === PaymentMode.UPI) {
    const parts = [];
    if (meta.upiId) parts.push(`UPI: ${meta.upiId}`);
    if (meta.utr) parts.push(`UTR: ${meta.utr}`);
    return parts.join(" · ");
  }
  if (mode === PaymentMode.CARD) {
    const parts = [];
    if (meta.cardType) parts.push(meta.cardType);
    if (meta.last4) parts.push(`****${meta.last4}`);
    if (meta.authCode) parts.push(`Auth: ${meta.authCode}`);
    return parts.join(" · ");
  }
  if (mode === PaymentMode.BANK_TRANSFER) {
    const parts = [];
    if (meta.transferType) parts.push(meta.transferType);
    if (meta.bankName) parts.push(meta.bankName);
    if (meta.bankRef) parts.push(`Ref: ${meta.bankRef}`);
    return parts.join(" · ");
  }
  if (mode === PaymentMode.CHEQUE) {
    const parts = [];
    if (meta.chequeNumber) parts.push(`Cheque #${meta.chequeNumber}`);
    if (meta.chequeBank) parts.push(meta.chequeBank);
    if (meta.chequeDate) parts.push(meta.chequeDate);
    return parts.join(" · ");
  }
  return "";
}

export function PaymentPanel({
  bookingId,
  payments,
  balanceAmount,
}: {
  bookingId: string;
  payments: Payment[];
  balanceAmount: number;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

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
      const r = await fetch(`/api/bookings/${bookingId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: data.amount,
          mode: data.mode,
          purpose: data.purpose,
          isRefund: data.isRefund,
          notes: data.notes,
          metadata,
          transactionRef: data.utr || data.bankRef || data.chequeNumber || data.authCode || undefined,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json?.error ?? "Failed");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking", bookingId] });
      setOpen(false);
      reset();
      toast({ title: "Payment recorded" });
    },
    onError: () => toast({ title: "Failed to record payment", variant: "destructive" }),
  });

  const totalPaid = payments.filter((p) => !p.isRefund).reduce((s, p) => s + p.amount, 0);
  const totalRefunded = payments.filter((p) => p.isRefund).reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm">
          <span className="text-muted-foreground">{payments.length} transaction{payments.length !== 1 ? "s" : ""}</span>
          {totalPaid > 0 && <span className="text-green-700 font-medium">Paid: {formatCurrency(totalPaid)}</span>}
          {totalRefunded > 0 && <span className="text-red-600 font-medium">Refunded: {formatCurrency(totalRefunded)}</span>}
          {balanceAmount > 0 && <span className="text-orange-600 font-medium">Balance: {formatCurrency(balanceAmount)}</span>}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-2">
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
                    type="number"
                    step="0.01"
                    placeholder={balanceAmount > 0 ? `Full balance: ${balanceAmount}` : "0.00"}
                    {...register("amount")}
                  />
                  {balanceAmount > 0 && enteredAmount > 0 && Number(enteredAmount) < balanceAmount && (
                    <span className="absolute right-3 top-2 text-xs text-orange-600 font-medium">Partial</span>
                  )}
                  {balanceAmount > 0 && Number(enteredAmount) >= balanceAmount && (
                    <span className="absolute right-3 top-2 text-xs text-green-600 font-medium">Full</span>
                  )}
                </div>
                {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
                {balanceAmount > 0 && !isRefund && (
                  <p className="text-xs text-muted-foreground">
                    Outstanding balance: <span className="font-medium text-orange-600">{formatCurrency(balanceAmount)}</span>
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
                    <div className="space-y-1">
                      <Label className="text-xs">Payer UPI ID</Label>
                      <Input placeholder="name@upi" {...register("upiId")} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">UTR / Transaction ID *</Label>
                      <Input placeholder="12-digit UTR" {...register("utr")} />
                    </div>
                  </div>
                </div>
              )}

              {selectedMode === PaymentMode.CARD && (
                <div className="space-y-3 p-3 bg-muted/40 rounded-md">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Card Details</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Card Type</Label>
                      <Controller name="cardType" control={control} render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DEBIT">Debit</SelectItem>
                            <SelectItem value="CREDIT">Credit</SelectItem>
                          </SelectContent>
                        </Select>
                      )} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Last 4 Digits</Label>
                      <Input placeholder="1234" maxLength={4} {...register("last4")} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Auth Code</Label>
                      <Input placeholder="Auth #" {...register("authCode")} />
                    </div>
                  </div>
                </div>
              )}

              {selectedMode === PaymentMode.BANK_TRANSFER && (
                <div className="space-y-3 p-3 bg-muted/40 rounded-md">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bank Transfer Details</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Transfer Type</Label>
                      <Controller name="transferType" control={control} render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger><SelectValue placeholder="NEFT/RTGS" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NEFT">NEFT</SelectItem>
                            <SelectItem value="RTGS">RTGS</SelectItem>
                            <SelectItem value="IMPS">IMPS</SelectItem>
                            <SelectItem value="NET_BANKING">Net Banking</SelectItem>
                          </SelectContent>
                        </Select>
                      )} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Bank Name</Label>
                      <Input placeholder="SBI, HDFC..." {...register("bankName")} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">UTR / Ref Number *</Label>
                      <Input placeholder="Reference #" {...register("bankRef")} />
                    </div>
                  </div>
                </div>
              )}

              {selectedMode === PaymentMode.CHEQUE && (
                <div className="space-y-3 p-3 bg-muted/40 rounded-md">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cheque Details</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Cheque Number *</Label>
                      <Input placeholder="123456" {...register("chequeNumber")} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Bank Name</Label>
                      <Input placeholder="Bank name" {...register("chequeBank")} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cheque Date</Label>
                      <Input type="date" {...register("chequeDate")} />
                    </div>
                  </div>
                </div>
              )}

              {/* Notes + Refund */}
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
      </div>

      {/* Payment list */}
      {payments.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <CreditCard className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No payments recorded yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {payments.map((p) => {
            const meta = p.metadata as Record<string, string> | null;
            const summary = meta ? metaSummary(p.mode, meta) : null;
            return (
              <div key={p.id} className="flex items-start justify-between p-3 bg-card border rounded-md gap-3">
                <div className="flex items-start gap-3">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${p.isRefund ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>
                    {modeIcons[p.mode]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {purposeLabels[p.purpose]}
                      <span className="text-muted-foreground font-normal"> · {modeLabels[p.mode]}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(p.receivedAt)} · by {p.receivedBy.name}
                    </p>
                    {summary && (
                      <p className="text-xs text-muted-foreground mt-0.5">{summary}</p>
                    )}
                    {p.transactionRef && !summary && (
                      <p className="text-xs text-muted-foreground mt-0.5">Ref: {p.transactionRef}</p>
                    )}
                    {p.notes && (
                      <p className="text-xs text-muted-foreground italic mt-0.5">{p.notes}</p>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`font-semibold text-base ${p.isRefund ? "text-red-600" : "text-green-700"}`}>
                    {p.isRefund ? "−" : "+"}{formatCurrency(p.amount)}
                  </span>
                  {p.isRefund && <p className="text-xs text-red-500">Refund</p>}
                </div>
              </div>
            );
          })}
          {/* Running total */}
          <div className="flex justify-between items-center pt-2 border-t text-sm px-1">
            <span className="text-muted-foreground">Net paid</span>
            <span className="font-semibold text-green-700">{formatCurrency(totalPaid - totalRefunded)}</span>
          </div>
          {balanceAmount > 0 && (
            <div className="flex justify-between items-center text-sm px-1">
              <span className="text-muted-foreground">Balance due</span>
              <span className="font-semibold text-orange-600">{formatCurrency(balanceAmount)}</span>
            </div>
          )}
          {balanceAmount <= 0 && payments.length > 0 && (
            <div className="flex items-center gap-2 text-green-700 text-sm px-1">
              <CheckCircle className="h-4 w-4" /><span className="font-medium">Fully settled</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
