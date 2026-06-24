export type BookingStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface Client {
  name: string;
  email: string;
  phone: string;
}

export interface Booking {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  status: BookingStatus;
  createdAt: string;
}

export interface BusinessConfig {
  startHour: string; // e.g. "08:00"
  endHour: string;   // e.g. "19:00"
  slotDurationMinutes: number; // e.g. 30 or 60
  lunchStart: string; // e.g. "12:00"
  lunchEnd: string;   // e.g. "13:30"
  closedDays: number[]; // Sundays (0) by default
}

export interface DashboardStats {
  totalBookings: number;
  pendingBookings: number;
  approvedBookings: number;
  cancelledBookings: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // hashed password
  createdAt: string;
}

export type OmitPasswordUser = Omit<User, 'password'>;

