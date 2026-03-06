"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";

const statusColors: Record<string, string> = {
  ENQUIRY: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export default function BookingsPage() {
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["bookings", status],
    queryFn: () => fetch(`/api/bookings?${params}`).then((r) => r.json()),
  });

  const filtered = bookings.filter((b: { bookingNumber: string; client: { name: string; phone: string } }) =>
    !search ||
    b.bookingNumber.toLowerCase().includes(search.toLowerCase()) ||
    b.client.name.toLowerCase().includes(search.toLowerCase()) ||
    b.client.phone.includes(search)
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Bookings</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} bookings</p>
        </div>
        <Link href="/bookings/new">
          <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> New Booking</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, phone, booking #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ENQUIRY">Enquiry</SelectItem>
            <SelectItem value="CONFIRMED">Confirmed</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Booking #</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Hall</TableHead>
              <TableHead>Event Type</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No bookings found</TableCell></TableRow>
            ) : (
              filtered.map((b: {
                id: string; bookingNumber: string; eventType: string; startDate: string;
                grandTotal: number; balanceAmount: number; status: string;
                client: { name: string; phone: string };
                hall: { name: string; venue: { name: string } };
              }) => (
                <TableRow key={b.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <Link href={`/bookings/${b.id}`} className="font-medium text-primary hover:underline">
                      #{b.bookingNumber.slice(-8)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{b.client.name}</p>
                    <p className="text-xs text-muted-foreground">{b.client.phone}</p>
                  </TableCell>
                  <TableCell>
                    <p>{b.hall.name}</p>
                    <p className="text-xs text-muted-foreground">{b.hall.venue.name}</p>
                  </TableCell>
                  <TableCell>{b.eventType.replace("_", " ")}</TableCell>
                  <TableCell>{formatDate(b.startDate)}</TableCell>
                  <TableCell>{formatCurrency(b.grandTotal)}</TableCell>
                  <TableCell className={b.balanceAmount > 0 ? "text-orange-600 font-medium" : "text-green-600 font-medium"}>
                    {formatCurrency(b.balanceAmount)}
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[b.status]}`}>
                      {b.status.replace("_", " ")}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
