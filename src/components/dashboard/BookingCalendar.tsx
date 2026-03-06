"use client";

import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Users, Building2, Clock, IndianRupee, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

interface CalBooking {
  id: string;
  bookingNumber: string;
  eventType: string;
  startDate: string;
  endDate: string;
  timeSlot: string;
  guestCount: number;
  status: string;
  grandTotal: number;
  balanceAmount: number;
  client: { name: string; phone: string };
  hall: { name: string; venue: { name: string } };
}

const statusColor: Record<string, string> = {
  ENQUIRY:     "bg-yellow-400 text-yellow-900",
  CONFIRMED:   "bg-blue-500 text-white",
  IN_PROGRESS: "bg-purple-500 text-white",
  COMPLETED:   "bg-green-500 text-white",
  CANCELLED:   "bg-red-400 text-white line-through opacity-60",
};

const statusDot: Record<string, string> = {
  ENQUIRY:     "bg-yellow-400",
  CONFIRMED:   "bg-blue-500",
  IN_PROGRESS: "bg-purple-500",
  COMPLETED:   "bg-green-500",
  CANCELLED:   "bg-red-400",
};

const slotLabel: Record<string, string> = {
  MORNING:  "Morning",
  EVENING:  "Evening",
  FULL_DAY: "Full Day",
};

const eventLabel: Record<string, string> = {
  WEDDING: "Wedding", BIRTHDAY: "Birthday", CORPORATE: "Corporate",
  RECEPTION: "Reception", CONFERENCE: "Conference", SOCIAL: "Social", OTHER: "Other",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function bookingCoversDay(b: CalBooking, day: Date) {
  const start = new Date(b.startDate);
  const end = new Date(b.endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return day >= start && day <= end;
}

interface PopupState {
  booking: CalBooking;
  x: number;
  y: number;
}

export function BookingCalendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [popup, setPopup] = useState<PopupState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const from = new Date(year, month, 1).toISOString();
  const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

  const { data: bookings = [] } = useQuery<CalBooking[]>({
    queryKey: ["calendar-bookings", year, month],
    queryFn: () =>
      fetch(`/api/bookings?from=${from}&to=${to}`).then((r) => r.json()),
  });

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setPopup(null);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setPopup(null);
  }

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  function handleChipEnter(e: React.MouseEvent, booking: CalBooking) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPopup({
      booking,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }

  function handleChipLeave() {
    // Small delay so user can move to popup
    setTimeout(() => setPopup(p => p), 0);
  }

  const monthName = new Date(year, month).toLocaleString("default", { month: "long" });

  return (
    <div ref={containerRef} className="relative select-none">
      {/* Header row 1: month + nav */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-base font-semibold">{monthName} {year}</h3>
          <p className="text-xs text-muted-foreground">{bookings.length} booking{bookings.length !== 1 ? "s" : ""} this month</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}>
            Today
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {/* Header row 2: legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 text-xs text-muted-foreground">
        {Object.entries(statusDot).map(([s, cls]) => (
          <span key={s} className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full shrink-0 ${cls}`} />
            {s.replace("_", " ")}
          </span>
        ))}
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 border-l border-t rounded-md overflow-hidden">
        {cells.map((day, i) => {
          const isToday = day ? isSameDay(day, today) : false;
          const dayBookings = day ? bookings.filter((b) => bookingCoversDay(b, day)) : [];

          return (
            <div
              key={i}
              className={`border-r border-b min-h-[60px] sm:min-h-[88px] p-1 ${!day ? "bg-muted/30" : "bg-background"}`}
            >
              {day && (
                <>
                  <div className={`text-xs font-medium mb-1 w-5 h-5 flex items-center justify-center rounded-full
                    ${isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                    {day.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {dayBookings.slice(0, 3).map((b) => (
                      <button
                        key={b.id}
                        className={`w-full text-left text-[10px] font-medium px-1.5 py-0.5 rounded truncate leading-tight
                          ${statusColor[b.status]} hover:opacity-80 transition-opacity cursor-pointer`}
                        onMouseEnter={(e) => handleChipEnter(e, b)}
                        onMouseLeave={() => setPopup(null)}
                        onClick={() => setPopup(p => p?.booking.id === b.id ? null : { booking: b, x: 0, y: 0 })}
                      >
                        {b.client.name}
                      </button>
                    ))}
                    {dayBookings.length > 3 && (
                      <p className="text-[10px] text-muted-foreground px-1">+{dayBookings.length - 3} more</p>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Hover Popup */}
      {popup && (
        <div
          className="absolute z-50 w-72 bg-popover border rounded-lg shadow-xl p-4 space-y-3 text-sm pointer-events-auto"
          style={{
            left: Math.min(popup.x + 12, (containerRef.current?.offsetWidth ?? 800) - 300),
            top: popup.y + 12,
          }}
          onMouseEnter={() => {/* keep open */}}
          onMouseLeave={() => setPopup(null)}
        >
          {/* Popup header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor[popup.booking.status]}`}>
                {popup.booking.status.replace("_", " ")}
              </span>
              <p className="font-semibold mt-1.5 text-foreground">{popup.booking.client.name}</p>
              <p className="text-xs text-muted-foreground">{popup.booking.client.phone}</p>
            </div>
            <button onClick={() => setPopup(null)} className="text-muted-foreground hover:text-foreground mt-0.5">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="border-t pt-2 space-y-1.5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="text-xs">{popup.booking.hall.name} · {popup.booking.hall.venue.name}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span className="text-xs">
                {eventLabel[popup.booking.eventType]} · {slotLabel[popup.booking.timeSlot] ?? popup.booking.timeSlot}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span className="text-xs">{popup.booking.guestCount} guests</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <IndianRupee className="h-3.5 w-3.5 shrink-0" />
              <span className="text-xs">
                {formatCurrency(popup.booking.grandTotal)}
                {popup.booking.balanceAmount > 0 && (
                  <span className="text-orange-600 ml-1">· Balance: {formatCurrency(popup.booking.balanceAmount)}</span>
                )}
                {popup.booking.balanceAmount <= 0 && (
                  <span className="text-green-600 ml-1">· Settled</span>
                )}
              </span>
            </div>
          </div>

          <div className="border-t pt-2 flex justify-between items-center">
            <span className="text-[10px] text-muted-foreground">#{popup.booking.bookingNumber.slice(-8)}</span>
            <Link
              href={`/bookings/${popup.booking.id}`}
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => setPopup(null)}
            >
              View booking →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
