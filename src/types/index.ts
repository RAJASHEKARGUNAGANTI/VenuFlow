export type { UserRole, BookingStatus, EventType, PaymentMode, PaymentPurpose, AmenityCategory, TimeSlot } from "@prisma/client";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  venueId: string | null;
}

export interface LineItem {
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
}
