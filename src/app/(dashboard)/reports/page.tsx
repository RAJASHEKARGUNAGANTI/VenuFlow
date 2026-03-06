"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { TrendingUp, CreditCard, Calendar, Download } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { createWorkbook, downloadWorkbook } from "@/lib/exportExcel";
import { Skeleton } from "@/components/ui/skeleton";

const statusColors: Record<string, string> = {
  ENQUIRY: "bg-yellow-400",
  CONFIRMED: "bg-blue-400",
  IN_PROGRESS: "bg-purple-400",
  COMPLETED: "bg-green-400",
  CANCELLED: "bg-red-400",
};

const modeLabels: Record<string, string> = {
  CASH: "Cash", UPI: "UPI", BANK_TRANSFER: "Bank Transfer", CHEQUE: "Cheque", CARD: "Card",
};

export default function ReportsPage() {
  const thisYear = new Date().getFullYear();
  const [from, setFrom] = useState(`${thisYear}-01-01`);
  const [to, setTo] = useState(new Date().toISOString().split("T")[0]);
  const [submitted, setSubmitted] = useState({ from: `${thisYear}-01-01`, to: new Date().toISOString().split("T")[0] });

  const { data, isLoading } = useQuery({
    queryKey: ["reports", submitted.from, submitted.to],
    queryFn: () =>
      fetch(`/api/reports?from=${submitted.from}T00:00:00Z&to=${submitted.to}T23:59:59Z`).then((r) => r.json()),
  });

  const summary = data?.summary ?? {};
  const byEventType: Record<string, { count: number; revenue: number }> = data?.byEventType ?? {};
  const byMonth: Record<string, number> = data?.byMonth ?? {};
  const byMode: Record<string, number> = data?.byMode ?? {};
  const byStatus: Record<string, number> = data?.byStatus ?? {};

  const maxMonth = Math.max(...Object.values(byMonth), 1);

  function exportReport() {
    const summaryRows = [
      { Metric: "Total Revenue Collected", Value: summary.totalRevenue ?? 0 },
      { Metric: "Total Outstanding", Value: summary.totalOutstanding ?? 0 },
      { Metric: "Total Bookings", Value: summary.totalBookings ?? 0 },
    ];
    const monthRows = Object.entries(byMonth).map(([month, amount]) => ({ Month: month, Revenue: amount }));
    const eventRows = Object.entries(byEventType).map(([type, d]) => ({
      "Event Type": type.replace("_", " "),
      Bookings: d.count,
      Revenue: d.revenue,
    }));
    const modeRows = Object.entries(byMode).map(([mode, amount]) => ({
      Mode: modeLabels[mode] ?? mode,
      Amount: amount,
    }));
    const statusRows = Object.entries(byStatus).map(([status, count]) => ({
      Status: status.replace("_", " "),
      Count: count,
    }));
    const filename = `report_${submitted.from}_to_${submitted.to}`;
    downloadWorkbook(
      createWorkbook(
        { name: "Summary", rows: summaryRows },
        { name: "Revenue by Month", rows: monthRows },
        { name: "By Event Type", rows: eventRows },
        { name: "Payment Modes", rows: modeRows },
        { name: "Booking Status", rows: statusRows },
      ),
      filename,
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Reports & Analytics</h2>
        <p className="text-sm text-muted-foreground">Business insights and revenue tracking</p>
      </div>

      {/* Date Filter */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-1">
              <Label>From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </div>
            <Button onClick={() => setSubmitted({ from, to })} disabled={isLoading}>
              {isLoading ? "Loading..." : "Apply"}
            </Button>
            <Button variant="outline" className="gap-2" onClick={exportReport} disabled={isLoading || !data}>
              <Download className="h-4 w-4" /> Export Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue Collected</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-7 w-36" /> : <p className="text-2xl font-bold">{formatCurrency(summary.totalRevenue ?? 0)}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Outstanding</CardTitle>
            <CreditCard className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-7 w-36" /> : <p className="text-2xl font-bold text-orange-600">{formatCurrency(summary.totalOutstanding ?? 0)}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-7 w-20" /> : <p className="text-2xl font-bold">{summary.totalBookings ?? 0}</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Month */}
        <Card>
          <CardHeader><CardTitle className="text-base">Revenue by Month</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i}><div className="flex justify-between mb-1"><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-16" /></div><Skeleton className="h-2 w-full rounded-full" /></div>
                ))}
              </div>
            ) : Object.keys(byMonth).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No data</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(byMonth).map(([month, amount]) => (
                  <div key={month}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{month}</span>
                      <span className="font-medium">{formatCurrency(amount)}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${(amount / maxMonth) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue by Event Type */}
        <Card>
          <CardHeader><CardTitle className="text-base">Bookings by Event Type</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(byEventType).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No data</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(byEventType).map(([type, data]) => (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <span className="text-sm">{type.replace("_", " ")}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatCurrency(data.revenue)}</p>
                      <p className="text-xs text-muted-foreground">{data.count} booking{data.count !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Modes */}
        <Card>
          <CardHeader><CardTitle className="text-base">Payment Modes</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(byMode).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No data</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(byMode).map(([mode, amount]) => (
                  <div key={mode} className="flex justify-between items-center py-1 border-b last:border-0">
                    <span className="text-sm">{modeLabels[mode] ?? mode}</span>
                    <span className="font-medium text-sm">{formatCurrency(amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Booking Status */}
        <Card>
          <CardHeader><CardTitle className="text-base">Booking Status Overview</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(byStatus).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No data</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(byStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${statusColors[status] ?? "bg-gray-400"}`} />
                    <span className="text-sm flex-1">{status.replace("_", " ")}</span>
                    <span className="font-medium text-sm">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
