"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line, CartesianGrid,
} from "recharts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CreditCard, TrendingUp, CheckCircle, AlertCircle,
  Banknote, Smartphone, Building2, FileCheck, ArrowUpRight, Search, X, Download, Calendar,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { createWorkbook, downloadWorkbook } from "@/lib/exportExcel";
import { PaymentMode, PaymentPurpose } from "@prisma/client";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  booking: {
    id: string;
    bookingNumber: string;
    grandTotal: number;
    paidAmount: number;
    balanceAmount: number;
    status: string;
    startDate: string;
    client: { name: string; phone: string; email: string | null };
    hall: { name: string; venue: { name: string } };
  };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const modeLabels: Record<PaymentMode, string> = {
  CASH: "Cash", UPI: "UPI", BANK_TRANSFER: "Bank Transfer",
  CHEQUE: "Cheque", CARD: "Card",
};

const modeIcons: Record<PaymentMode, React.ReactNode> = {
  CASH: <Banknote className="h-3.5 w-3.5" />,
  UPI: <Smartphone className="h-3.5 w-3.5" />,
  BANK_TRANSFER: <Building2 className="h-3.5 w-3.5" />,
  CHEQUE: <FileCheck className="h-3.5 w-3.5" />,
  CARD: <CreditCard className="h-3.5 w-3.5" />,
};

const modeColors: Record<PaymentMode, string> = {
  CASH:          "#22c55e",
  UPI:           "#3b82f6",
  BANK_TRANSFER: "#8b5cf6",
  CHEQUE:        "#f59e0b",
  CARD:          "#ec4899",
};

const purposeLabels: Record<PaymentPurpose, string> = {
  ADVANCE_DEPOSIT: "Advance", INSTALLMENT: "Installment",
  AMENITY_ADDITION: "Amenity", FINAL_SETTLEMENT: "Final", REFUND: "Refund",
};

const purposeColors = ["#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ef4444"];

const statusColors: Record<string, string> = {
  ENQUIRY: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

type ChartPeriod = "all" | "yearly" | "monthly" | "weekly" | "daily";

function getISOWeek(d: Date): { year: number; week: number } {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const year = tmp.getUTCFullYear();
  const week = Math.ceil(((tmp.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return { year, week };
}

function getPeriodKey(date: string, period: ChartPeriod): string {
  const d = new Date(date);
  if (period === "yearly") return `${d.getFullYear()}`;
  if (period === "monthly") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  if (period === "weekly") {
    const { year, week } = getISOWeek(d);
    return `${year}-W${String(week).padStart(2, "0")}`;
  }
  if (period === "daily") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return "All Time";
}

function getPeriodLabel(key: string, period: ChartPeriod): string {
  if (period === "yearly") return key;
  if (period === "monthly") {
    const [y, m] = key.split("-");
    return new Date(Number(y), Number(m) - 1).toLocaleString("default", { month: "short", year: "2-digit" });
  }
  if (period === "weekly") {
    const [y, wPart] = key.split("-W");
    const w = Number(wPart);
    const jan4 = new Date(Date.UTC(Number(y), 0, 4));
    const monday = new Date(jan4.getTime() + (w - 1) * 7 * 86400000);
    monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() || 7) + 1);
    return `W${wPart} ${monday.toLocaleString("default", { month: "short", day: "numeric" })}`;
  }
  if (period === "daily") {
    const [y, m, day] = key.split("-");
    return new Date(Number(y), Number(m) - 1, Number(day)).toLocaleString("default", { month: "short", day: "numeric" });
  }
  return "All Time";
}

const PERIOD_LABELS: Record<ChartPeriod, string> = {
  all: "All", yearly: "Yearly", monthly: "Monthly", weekly: "Weekly", daily: "Daily",
};

// ── Custom Tooltip ────────────────────────────────────────────────────────────

function CurrencyTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border rounded-lg shadow-lg px-3 py-2 text-xs space-y-1">
      {label && <p className="font-semibold text-foreground mb-1">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium text-foreground">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { amount: number } }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="bg-popover border rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold">{p.name}</p>
      <p className="text-muted-foreground">{formatCurrency(p.payload.amount)}</p>
      <p className="text-muted-foreground">{p.value}%</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const thisYear = new Date().getFullYear();
  const todayStr = new Date().toISOString().split("T")[0];
  const [from, setFrom] = useState(`${thisYear}-01-01`);
  const [to, setTo] = useState(todayStr);
  const [submitted, setSubmitted] = useState({ from: `${thisYear}-01-01`, to: todayStr });

  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState("all");
  const [filterPurpose, setFilterPurpose] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all"); // all | payment | refund
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("monthly");

  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ["all-payments", submitted.from, submitted.to],
    queryFn: () =>
      fetch(`/api/payments?from=${submitted.from}T00:00:00Z&to=${submitted.to}T23:59:59Z`).then((r) => r.json()),
  });

  if (isLoading) return (
    <div className="space-y-6">
      <div><Skeleton className="h-6 w-32" /><Skeleton className="h-4 w-48 mt-1" /></div>
      <Card><CardContent className="pt-4 pb-4"><div className="flex gap-4"><Skeleton className="h-8 w-36" /><Skeleton className="h-8 w-36" /><Skeleton className="h-8 w-20" /></div></CardContent></Card>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="pt-5 pb-5"><Skeleton className="h-4 w-24 mb-3" /><Skeleton className="h-7 w-32" /><Skeleton className="h-3 w-20 mt-2" /></CardContent></Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2"><CardContent className="pt-5"><Skeleton className="h-[220px] w-full" /></CardContent></Card>
        <Card><CardContent className="pt-5"><Skeleton className="h-[220px] w-full" /></CardContent></Card>
      </div>
      <Card>
        <CardContent className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20 ml-auto" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );

  // ── Aggregations (always on full data) ────────────────────────────────────

  const collected = payments.filter((p) => !p.isRefund).reduce((s, p) => s + p.amount, 0);
  const refunded  = payments.filter((p) =>  p.isRefund).reduce((s, p) => s + p.amount, 0);
  const netCollected = collected - refunded;

  // Unique bookings
  const bookingMap = new Map<string, Payment["booking"]>();
  payments.forEach((p) => bookingMap.set(p.booking.id, p.booking));
  const allBookings = Array.from(bookingMap.values());
  const outstanding = allBookings.filter((b) => b.balanceAmount > 0 && b.status !== "CANCELLED");
  const totalOutstanding = outstanding.reduce((s, b) => s + b.balanceAmount, 0);

  // Mode breakdown (pie)
  const modeMap: Record<string, number> = {};
  payments.filter((p) => !p.isRefund).forEach((p) => {
    modeMap[p.mode] = (modeMap[p.mode] ?? 0) + p.amount;
  });
  const totalForPct = Object.values(modeMap).reduce((s, v) => s + v, 0);
  const modeData = Object.entries(modeMap).map(([mode, amount]) => ({
    name: modeLabels[mode as PaymentMode],
    amount,
    value: totalForPct > 0 ? Math.round((amount / totalForPct) * 100) : 0,
    color: modeColors[mode as PaymentMode],
  }));

  // Purpose breakdown (pie)
  const purposeMap: Record<string, number> = {};
  payments.filter((p) => !p.isRefund).forEach((p) => {
    purposeMap[p.purpose] = (purposeMap[p.purpose] ?? 0) + p.amount;
  });
  const purposeData = Object.entries(purposeMap).map(([purpose, amount], i) => ({
    name: purposeLabels[purpose as PaymentPurpose],
    amount,
    value: totalForPct > 0 ? Math.round((amount / totalForPct) * 100) : 0,
    color: purposeColors[i % purposeColors.length],
  }));

  // Trend data — grouped by chartPeriod
  const trendMap: Record<string, { collected: number; refunded: number }> = {};
  payments.forEach((p) => {
    const k = getPeriodKey(p.receivedAt, chartPeriod);
    if (!trendMap[k]) trendMap[k] = { collected: 0, refunded: 0 };
    if (p.isRefund) trendMap[k].refunded += p.amount;
    else trendMap[k].collected += p.amount;
  });
  const trendData = Object.entries(trendMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => ({
      label: getPeriodLabel(k, chartPeriod),
      Collected: v.collected,
      Refunded: v.refunded,
      Net: v.collected - v.refunded,
    }));

  // ── Filtered list (for table only) ────────────────────────────────────────

  const q = search.trim().toLowerCase();
  const filtered = payments.filter((p) => {
    if (q) {
      const c = p.booking.client;
      const match =
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        p.booking.bookingNumber.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filterMode !== "all" && p.mode !== filterMode) return false;
    if (filterPurpose !== "all" && p.purpose !== filterPurpose) return false;
    if (filterStatus !== "all" && p.booking.status !== filterStatus) return false;
    if (filterType === "payment" && p.isRefund) return false;
    if (filterType === "refund" && !p.isRefund) return false;
    return true;
  });

  const hasFilters = q || filterMode !== "all" || filterPurpose !== "all" || filterStatus !== "all" || filterType !== "all";

  function exportPayments() {
    const rows = filtered.map((p) => ({
      Date: formatDate(p.receivedAt),
      "Booking #": p.booking.bookingNumber,
      Client: p.booking.client.name,
      Phone: p.booking.client.phone,
      Email: p.booking.client.email ?? "",
      Hall: p.booking.hall.name,
      Venue: p.booking.hall.venue.name,
      Mode: modeLabels[p.mode],
      Purpose: purposeLabels[p.purpose],
      Type: p.isRefund ? "Refund" : "Payment",
      "Booking Status": p.booking.status.replace("_", " "),
      Amount: p.isRefund ? -p.amount : p.amount,
      "Transaction Ref": p.transactionRef ?? "",
      Notes: p.notes ?? "",
      "Received By": p.receivedBy.name,
      "Grand Total": p.booking.grandTotal,
      "Paid Amount": p.booking.paidAmount,
      "Balance": p.booking.balanceAmount,
    }));
    const label = hasFilters ? "filtered" : "all";
    downloadWorkbook(createWorkbook({ name: "Payments", rows }), `payments_${label}_${new Date().toISOString().split("T")[0]}`);
  }

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h2 className="text-xl font-semibold">Payments</h2>
        <p className="text-sm text-muted-foreground">
          {payments.length} transactions · {allBookings.length} bookings
        </p>
      </div>

      {/* ── Date range filter ── */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-end gap-4 flex-wrap">
            <Calendar className="h-4 w-4 text-muted-foreground mb-2 shrink-0" />
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36 h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36 h-8 text-sm" />
            </div>
            <Button size="sm" onClick={() => setSubmitted({ from, to })} disabled={isLoading}>
              {isLoading ? "Loading..." : "Apply"}
            </Button>
            <p className="text-xs text-muted-foreground mb-2">
              Showing: <strong>{submitted.from}</strong> → <strong>{submitted.to}</strong>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Summary KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Total Collected</span>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-700">{formatCurrency(collected)}</p>
            <p className="text-xs text-muted-foreground mt-1">{payments.filter(p => !p.isRefund).length} payments</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Net Revenue</span>
              <CheckCircle className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold">{formatCurrency(netCollected)}</p>
            {refunded > 0 && <p className="text-xs text-red-500 mt-1">−{formatCurrency(refunded)} refunded</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Outstanding</span>
              <AlertCircle className="h-4 w-4 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalOutstanding)}</p>
            <p className="text-xs text-muted-foreground mt-1">{outstanding.length} bookings pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Collection Rate</span>
              <CreditCard className="h-4 w-4 text-purple-600" />
            </div>
            {(() => {
              const grandSum = allBookings.reduce((s, b) => s + b.grandTotal, 0);
              const rate = grandSum > 0 ? Math.round((netCollected / grandSum) * 100) : 0;
              return (
                <>
                  <p className="text-2xl font-bold text-purple-700">{rate}%</p>
                  <div className="mt-2 w-full bg-muted rounded-full h-1.5">
                    <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${rate}%` }} />
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* ── Charts row ── */}
      {/* Period toggle — shared across trend charts */}
      <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit">
        {(Object.keys(PERIOD_LABELS) as ChartPeriod[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setChartPeriod(p)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              chartPeriod === p
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Collection bar chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Collection Trend · {PERIOD_LABELS[chartPeriod]}</CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trendData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CurrencyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Collected" fill="#22c55e" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Refunded" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Payment mode donut */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Payment Mode Split</CardTitle>
          </CardHeader>
          <CardContent>
            {modeData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={modeData} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={2}>
                      {modeData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {modeData.map((d) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                        <span className="text-muted-foreground">{d.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{d.value}%</span>
                        <span className="font-medium w-20 text-right">{formatCurrency(d.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Net revenue line + purpose split ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Net line chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Net Revenue · {PERIOD_LABELS[chartPeriod]}</CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CurrencyTooltip />} />
                  <Line type="monotone" dataKey="Net" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 3 }} />
                  <Line type="monotone" dataKey="Collected" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Purpose donut */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Payment Purpose Split</CardTitle>
          </CardHeader>
          <CardContent>
            {purposeData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={purposeData} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={2}>
                      {purposeData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {purposeData.map((d) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                        <span className="text-muted-foreground">{d.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{d.value}%</span>
                        <span className="font-medium w-20 text-right">{formatCurrency(d.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── All transactions table ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              All Transactions ({filtered.length}{filtered.length !== payments.length ? ` of ${payments.length}` : ""})
            </CardTitle>
            <div className="flex items-center gap-2">
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => { setSearch(""); setFilterMode("all"); setFilterPurpose("all"); setFilterStatus("all"); setFilterType("all"); }}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <X className="h-3 w-3" /> Clear filters
                </button>
              )}
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={exportPayments} disabled={filtered.length === 0}>
                <Download className="h-3.5 w-3.5" /> Export Excel
              </Button>
            </div>
          </div>
          {/* Search + filters */}
          <div className="flex flex-wrap gap-2 pt-2">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-xs"
                placeholder="Search by name, phone, email, booking #..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterMode} onValueChange={setFilterMode}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Mode" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                {Object.entries(modeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterPurpose} onValueChange={setFilterPurpose}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Purpose" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Purposes</SelectItem>
                {Object.entries(purposeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {["ENQUIRY","CONFIRMED","IN_PROGRESS","COMPLETED","CANCELLED"].map((s) => (
                  <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="payment">Payments</SelectItem>
                <SelectItem value="refund">Refunds</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Client</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Mode</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Purpose</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Amount</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                      {hasFilters ? "No transactions match your filters" : "No payments recorded yet"}
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(p.receivedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-xs">{p.booking.client.name}</p>
                        <a href={`tel:${p.booking.client.phone}`} className="text-[11px] text-muted-foreground hover:underline hover:text-primary transition-colors">
                          {p.booking.client.phone}
                        </a>
                        {p.booking.client.email && (
                          <p className="text-[11px] text-muted-foreground">{p.booking.client.email}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground">#{p.booking.bookingNumber.slice(-8)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-muted-foreground">{modeIcons[p.mode]}</span>
                          {modeLabels[p.mode]}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {purposeLabels[p.purpose]}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusColors[p.booking.status] ?? ""}`}>
                          {p.booking.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold text-sm ${p.isRefund ? "text-red-600" : "text-green-700"}`}>
                          {p.isRefund ? "−" : "+"}{formatCurrency(p.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/bookings/${p.booking.id}/payments`}
                          className="text-xs text-primary hover:underline flex items-center gap-0.5 whitespace-nowrap"
                        >
                          View <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table footer totals */}
          {filtered.length > 0 && (() => {
            const fCollected = filtered.filter((p) => !p.isRefund).reduce((s, p) => s + p.amount, 0);
            const fRefunded  = filtered.filter((p) =>  p.isRefund).reduce((s, p) => s + p.amount, 0);
            return (
              <div className="border-t px-4 py-3 flex flex-wrap gap-4 text-sm bg-muted/20">
                {hasFilters && <span className="text-xs text-muted-foreground italic w-full">Showing filtered totals</span>}
                <span className="text-muted-foreground">
                  Collected: <strong className="text-green-700">{formatCurrency(fCollected)}</strong>
                </span>
                {fRefunded > 0 && (
                  <span className="text-muted-foreground">
                    Refunded: <strong className="text-red-600">{formatCurrency(fRefunded)}</strong>
                  </span>
                )}
                <span className="text-muted-foreground">
                  Net: <strong>{formatCurrency(fCollected - fRefunded)}</strong>
                </span>
                {!hasFilters && (
                  <span className="text-muted-foreground ml-auto">
                    Outstanding: <strong className="text-orange-600">{formatCurrency(totalOutstanding)}</strong>
                  </span>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
