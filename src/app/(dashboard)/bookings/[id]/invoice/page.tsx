"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, FileText, RefreshCw } from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface PaymentRecord {
  amount: number;
  mode: string;
  purpose: string;
  receivedAt: string;
  isRefund: boolean;
  transactionRef: string | null;
  metadata: Record<string, string> | null;
}

interface InvoiceData {
  invoiceNumber: string;
  issuedAt: string;
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  grandTotal: number;
  lineItems: LineItem[];
  issuedBy: { name: string };
  booking: {
    bookingNumber: string;
    eventType: string;
    startDate: string;
    endDate: string;
    timeSlot: string;
    guestCount: number;
    paidAmount: number;
    balanceAmount: number;
    client: { name: string; phone: string; email?: string; address?: string };
    hall: {
      name: string;
      venue: { name: string; address: string; city: string; phone: string; email?: string; gstNumber?: string };
    };
    payments: PaymentRecord[];
  };
}

const slotLabel: Record<string, string> = {
  MORNING: "Morning (6 AM – 1 PM)",
  EVENING: "Evening (2 PM – 10 PM)",
  FULL_DAY: "Full Day",
};

const eventLabel: Record<string, string> = {
  WEDDING: "Wedding", BIRTHDAY: "Birthday", CORPORATE: "Corporate",
  RECEPTION: "Reception", CONFERENCE: "Conference", SOCIAL: "Social Function", OTHER: "Other",
};

const modeLabel: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI",
  BANK_TRANSFER: "Bank Transfer",
  CHEQUE: "Cheque",
  CARD: "Card",
};

const purposeLabel: Record<string, string> = {
  ADVANCE_DEPOSIT: "Advance",
  INSTALLMENT: "Installment",
  AMENITY_ADDITION: "Amenity",
  FINAL_SETTLEMENT: "Final Settlement",
  REFUND: "Refund",
};

function paymentEvidence(p: PaymentRecord): string {
  const parts: string[] = [];
  const m = p.metadata;
  if (m) {
    if (m.upiId) parts.push(`UPI: ${m.upiId}`);
    if (m.utr) parts.push(`UTR: ${m.utr}`);
    if (m.cardType) parts.push(m.cardType);
    if (m.last4) parts.push(`****${m.last4}`);
    if (m.authCode) parts.push(`Auth: ${m.authCode}`);
    if (m.transferType) parts.push(m.transferType);
    if (m.bankName) parts.push(m.bankName);
    if (m.bankRef) parts.push(`Ref: ${m.bankRef}`);
    if (m.chequeNumber) parts.push(`Cheque #${m.chequeNumber}`);
    if (m.chequeBank) parts.push(m.chequeBank);
    if (m.chequeDate) parts.push(m.chequeDate);
  }
  if (p.transactionRef && parts.length === 0) parts.push(`Ref: ${p.transactionRef}`);
  return parts.join(" · ");
}

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const [regenerating, setRegenerating] = useState(false);

  const { data: invoice, isLoading, refetch } = useQuery<InvoiceData & { error?: string }>({
    queryKey: ["invoice", id],
    queryFn: () => fetch(`/api/bookings/${id}/invoice`).then((r) => r.json()),
    retry: false,
  });

  const generate = useMutation({
    mutationFn: () =>
      fetch(`/api/bookings/${id}/invoice`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => { setRegenerating(false); refetch(); },
    onError: () => setRegenerating(false),
  });

  if (isLoading) return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-md" />
        <div><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-32 mt-1" /></div>
        <div className="flex gap-2 ml-auto"><Skeleton className="h-9 w-36" /><Skeleton className="h-9 w-36" /></div>
      </div>
      <div className="border rounded-lg p-8 space-y-6">
        <div className="flex justify-between">
          <div className="space-y-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-56" /><Skeleton className="h-4 w-40" /></div>
          <div className="text-right space-y-2"><Skeleton className="h-8 w-28 ml-auto" /><Skeleton className="h-4 w-32 ml-auto" /></div>
        </div>
        <Skeleton className="h-px w-full" />
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-2"><Skeleton className="h-3 w-16" /><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-24" /></div>
          <div className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-4 w-36" /><Skeleton className="h-4 w-28" /><Skeleton className="h-4 w-32" /></div>
        </div>
        <Skeleton className="h-px w-full" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-4"><Skeleton className="h-4 flex-1" /><Skeleton className="h-4 w-8" /><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-20" /></div>
          ))}
        </div>
        <div className="flex justify-end"><div className="w-72 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /><Skeleton className="h-5 w-full" /></div></div>
      </div>
    </div>
  );

  if (!invoice || invoice.error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <FileText className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Invoice Generated</h2>
        <p className="text-muted-foreground text-sm text-center max-w-sm">
          Generate an invoice to capture a snapshot of the current booking, amenities, and payments.
        </p>
        <div className="flex gap-3">
          <Link href={`/bookings/${id}`}>
            <Button variant="outline" className="gap-2"><ArrowLeft className="h-4 w-4" /> Back</Button>
          </Link>
          <Button onClick={() => { setRegenerating(true); generate.mutate(); }} disabled={regenerating} className="gap-2">
            <FileText className="h-4 w-4" />
            {regenerating ? "Generating..." : "Generate Invoice"}
          </Button>
        </div>
      </div>
    );
  }

  const { booking } = invoice;
  const venue = booking.hall.venue;
  const netPaid = booking.payments.filter((p) => !p.isRefund).reduce((s, p) => s + p.amount, 0);
  const totalRefunded = booking.payments.filter((p) => p.isRefund).reduce((s, p) => s + p.amount, 0);
  // Balance = invoice grand total (GST-inclusive) minus net paid
  const balanceDue = Math.max(0, invoice.grandTotal - (netPaid - totalRefunded));

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          @page { margin: 12mm; }
          body * { visibility: hidden; }
          #invoice-root, #invoice-root * { visibility: visible; }
          #invoice-root {
            position: absolute; top: 0; left: 0;
            width: 100%; max-width: 100%;
            background: white; border: none !important;
            padding: 0 !important; margin: 0 !important;
            box-shadow: none !important; border-radius: 0 !important;
            font-size: 11px !important;
          }
          #invoice-root h1 { font-size: 18px !important; }
          #invoice-root .text-3xl { font-size: 22px !important; }
          #invoice-root .text-2xl { font-size: 16px !important; }
          #invoice-root .text-base { font-size: 12px !important; }
          #invoice-root table { page-break-inside: auto; }
          #invoice-root tr { page-break-inside: avoid; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print flex items-center gap-3 mb-6">
        <Link href={`/bookings/${id}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h2 className="text-xl font-semibold">Invoice {invoice.invoiceNumber}</h2>
          <p className="text-sm text-muted-foreground">Last updated {formatDate(invoice.issuedAt)}</p>
        </div>
        <Button variant="outline" onClick={() => { setRegenerating(true); generate.mutate(); }} disabled={regenerating} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${regenerating ? "animate-spin" : ""}`} />
          {regenerating ? "Updating..." : "Refresh Invoice"}
        </Button>
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" /> Print / Save PDF
        </Button>
      </div>

      {/* Invoice document */}
      <div id="invoice-root" className="bg-white text-black max-w-4xl mx-auto rounded-lg border p-8 space-y-5 text-sm">

        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{venue.name}</h1>
            <p className="text-gray-600 mt-1">{venue.address}, {venue.city}</p>
            {venue.phone && <p className="text-gray-600">Tel: <a href={`tel:${venue.phone}`} className="hover:underline">{venue.phone}</a></p>}
            {venue.email && <p className="text-gray-600">Email: {venue.email}</p>}
            {venue.gstNumber && <p className="text-gray-600">GSTIN: {venue.gstNumber}</p>}
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-200 tracking-wide">INVOICE</div>
            <p className="text-gray-900 font-semibold mt-2">{invoice.invoiceNumber}</p>
            <p className="text-gray-600 text-xs">Date: {formatDate(invoice.issuedAt)}</p>
          </div>
        </div>

        <hr className="border-gray-200" />

        {/* Bill to + Booking info */}
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Bill To</p>
            <p className="font-semibold text-gray-900">{booking.client.name}</p>
            <a href={`tel:${booking.client.phone}`} className="text-gray-600 hover:underline">{booking.client.phone}</a>
            {booking.client.email && <p className="text-gray-600">{booking.client.email}</p>}
            {booking.client.address && <p className="text-gray-600">{booking.client.address}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Booking Details</p>
            <div className="space-y-1 text-gray-700">
              <p><span className="text-gray-500">Booking #:</span> {booking.bookingNumber}</p>
              <p><span className="text-gray-500">Event:</span> {eventLabel[booking.eventType] ?? booking.eventType}</p>
              <p><span className="text-gray-500">Date:</span> {formatDate(booking.startDate)}{booking.startDate !== booking.endDate ? ` – ${formatDate(booking.endDate)}` : ""}</p>
              <p><span className="text-gray-500">Slot:</span> {slotLabel[booking.timeSlot] ?? booking.timeSlot}</p>
              <p><span className="text-gray-500">Hall:</span> {booking.hall.name}</p>
              <p><span className="text-gray-500">Guests:</span> {booking.guestCount}</p>
            </div>
          </div>
        </div>

        <hr className="border-gray-200" />

        {/* Line items */}
        <div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                <th className="text-center py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">Qty</th>
                <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">Unit Price</th>
                <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.lineItems as LineItem[]).map((item, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2.5 text-gray-900">{item.description}</td>
                  <td className="py-2.5 text-center text-gray-700">{item.quantity}</td>
                  <td className="py-2.5 text-right text-gray-700">{formatCurrency(item.unitPrice)}</td>
                  <td className="py-2.5 text-right font-medium text-gray-900">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-72 space-y-2">
            <div className="flex justify-between text-gray-700">
              <span>Subtotal</span>
              <span>{formatCurrency(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>GST ({invoice.gstRate}%)</span>
              <span>{formatCurrency(invoice.gstAmount)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 border-t border-gray-300 pt-2 text-base">
              <span>Grand Total</span>
              <span>{formatCurrency(invoice.grandTotal)}</span>
            </div>
          </div>
        </div>

        <hr className="border-gray-200" />

        {/* Payment History */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Payment History</p>
          {booking.payments.length === 0 ? (
            <p className="text-gray-500 italic text-sm">No payments recorded</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Purpose</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Mode</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Transaction Evidence</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                </tr>
              </thead>
              <tbody>
                {booking.payments.map((p, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 text-gray-600">{formatDate(p.receivedAt)}</td>
                    <td className="py-2 text-gray-700">{purposeLabel[p.purpose] ?? p.purpose}</td>
                    <td className="py-2 text-gray-700">{modeLabel[p.mode] ?? p.mode}</td>
                    <td className="py-2 text-gray-500 text-xs">{paymentEvidence(p) || "—"}</td>
                    <td className={`py-2 text-right font-medium ${p.isRefund ? "text-red-600" : "text-green-700"}`}>
                      {p.isRefund ? "−" : "+"}{formatCurrency(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Payment summary box */}
        <div className="flex justify-end">
          <div className="w-72 space-y-2 border border-gray-200 rounded-md p-4">
            <div className="flex justify-between text-gray-700">
              <span>Grand Total</span>
              <span className="font-semibold">{formatCurrency(invoice.grandTotal)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>Total Paid</span>
              <span className="font-medium text-green-700">{formatCurrency(netPaid)}</span>
            </div>
            {totalRefunded > 0 && (
              <div className="flex justify-between text-gray-700">
                <span>Refunded</span>
                <span className="font-medium text-red-600">− {formatCurrency(totalRefunded)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-2">
              <span>Balance Due</span>
              <span className={balanceDue > 0 ? "text-red-600" : "text-green-700"}>
                {formatCurrency(balanceDue)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-gray-400 text-xs pt-4 border-t border-gray-100">
          <p>Thank you for choosing {venue.name}!</p>
          {invoice.issuedBy?.name && <p className="mt-1">Issued by: {invoice.issuedBy.name}</p>}
        </div>
      </div>
    </>
  );
}
