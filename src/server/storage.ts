import bcrypt from "bcryptjs";
import { pool } from "./database";
import { Booking, BusinessConfig, BookingStatus, User } from "../types";

const getFutureDateString = (daysAhead: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split("T")[0];
};

const DEFAULT_CONFIG: BusinessConfig = {
  startHour: "08:00",
  endHour: "19:00",
  slotDurationMinutes: 60,
  lunchStart: "12:00",
  lunchEnd: "13:00",
  closedDays: [0],
};

const getDefaultBookings = (): Booking[] => [
  {
    id: "booking-1",
    clientName: "Rodrigo Pontes",
    clientEmail: "rodrigopontes126@gmail.com",
    clientPhone: "+55 88 99111-2222",
    date: getFutureDateString(0),
    time: "14:00",
    status: "pending",
    createdAt: new Date().toISOString(),
  },
  {
    id: "booking-2",
    clientName: "Carlos Silva",
    clientEmail: "carlossilva@email.com",
    clientPhone: "+55 88 98888-7777",
    date: getFutureDateString(1),
    time: "10:00",
    status: "approved",
    createdAt: new Date().toISOString(),
  },
];

const mapConfigFromPg = (r: any): BusinessConfig => {
  if (!r) return DEFAULT_CONFIG;
  return {
    startHour: r.start_hour,
    endHour: r.end_hour,
    slotDurationMinutes: r.slot_duration_minutes,
    lunchStart: r.lunch_start || null,
    lunchEnd: r.lunch_end || null,
    closedDays: Array.isArray(r.closed_days)
      ? r.closed_days
      : JSON.parse(r.closed_days || "[]"),
  };
};

const mapBookingFromPg = (r: any): Booking => ({
  id: r.id,
  clientName: r.client_name,
  clientEmail: r.client_email,
  clientPhone: r.client_phone,
  date: r.date,
  time: r.time,
  status: r.status as BookingStatus,
  createdAt:
    r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
});

const mapUserFromPg = (r: any): User => ({
  id: r.id,
  name: r.name,
  email: r.email,
  password: r.password,
  createdAt:
    r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
});

export class PostgreSQLDB {
  private initPromise: Promise<void>;
  private useFallback = false;

  private fallbackConfig: BusinessConfig = DEFAULT_CONFIG;
  private fallbackBookings: Booking[] = getDefaultBookings();
  private fallbackUsers: User[] = [];

  constructor() {
    this.initPromise = this.init();
  }

  private async init() {
    // Força o modo de simulação em memória estável para a apresentação na Vercel
    console.log(
      "[POSTGRES] Ativando Modo Fallback Resiliente em Memória para o ambiente de demonstração!",
    );
    this.activateFallback();
    return;
  }

  private activateFallback() {
    this.useFallback = true;
    const adminHash = bcrypt.hashSync("Jesuino@AdminSec2026$", 10);
    const rodrigoHash = bcrypt.hashSync("Rodrigo@SecurePass2026!", 10);

    this.fallbackUsers = [
      {
        id: "user-1",
        name: "Jesuino Admin",
        email: "admin@jesuinosbarbearia.com.br",
        password: adminHash,
        createdAt: new Date().toISOString(),
      },
      {
        id: "user-2",
        name: "Rodrigo Pontes (Admin)",
        email: "rodrigopontes126@gmail.com",
        password: rodrigoHash,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  public async ensureInitialized() {
    await this.initPromise;
  }

  public async getHealthInfo() {
    try {
      await this.ensureInitialized();
      return {
        status: "healthy",
        engine: "memory-fallback",
        stats: {
          configCount: 1,
          bookingsCount: this.fallbackBookings.length,
        },
      };
    } catch (err: any) {
      return {
        status: "unhealthy",
        engine: "fallback-error",
        error: err.message,
      };
    }
  }

  public async getBookings(): Promise<Booking[]> {
    await this.ensureInitialized();
    return [...this.fallbackBookings].sort((a, b) => {
      const diff = a.date.localeCompare(b.date);
      if (diff !== 0) return diff;
      return a.time.localeCompare(b.time);
    });
  }

  public async getBookingById(id: string): Promise<Booking | undefined> {
    await this.ensureInitialized();
    return this.fallbackBookings.find((b) => b.id === id);
  }

  public async createBooking(
    booking: Omit<Booking, "id" | "createdAt">,
  ): Promise<Booking> {
    await this.ensureInitialized();
    const id = `booking-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const createdAt = new Date().toISOString();
    const newB: Booking = { ...booking, id, createdAt };
    this.fallbackBookings.push(newB);
    return newB;
  }

  public async updateBooking(
    id: string,
    updates: Partial<Omit<Booking, "id" | "createdAt">>,
  ): Promise<Booking | null> {
    await this.ensureInitialized();
    const current = await this.getBookingById(id);
    if (!current) return null;
    const updated = { ...current, ...updates };
    this.fallbackBookings = this.fallbackBookings.map((b) =>
      b.id === id ? updated : b,
    );
    return updated;
  }

  public async deleteBooking(id: string): Promise<boolean> {
    await this.ensureInitialized();
    const originalLength = this.fallbackBookings.length;
    this.fallbackBookings = this.fallbackBookings.filter((b) => b.id !== id);
    return this.fallbackBookings.length < originalLength;
  }

  public async getConfig(): Promise<BusinessConfig> {
    await this.ensureInitialized();
    return this.fallbackConfig;
  }

  public async updateConfig(
    config: Partial<BusinessConfig>,
  ): Promise<BusinessConfig> {
    await this.ensureInitialized();
    const current = await this.getConfig();
    const updated = { ...current, ...config };
    this.fallbackConfig = updated;
    return updated;
  }

  public async getUserByEmail(email: string): Promise<User | undefined> {
    await this.ensureInitialized();
    return this.fallbackUsers.find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );
  }

  public async getUserById(id: string): Promise<User | undefined> {
    await this.ensureInitialized();
    return this.fallbackUsers.find((u) => u.id === id);
  }

  public async createUser(user: Omit<User, "id" | "createdAt">): Promise<User> {
    await this.ensureInitialized();
    const id = `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const createdAt = new Date().toISOString();
    const newU: User = { ...user, id, createdAt };
    this.fallbackUsers.push(newU);
    return newU;
  }
}

export const db = new PostgreSQLDB();
