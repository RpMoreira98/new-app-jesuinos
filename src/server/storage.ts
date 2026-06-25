import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { Booking, BusinessConfig, BookingStatus, User } from "../types";

// Inicializa o Prisma Client configurado para ler a URL da Render/Supabase
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

const DEFAULT_CONFIG: BusinessConfig = {
  startHour: "08:00",
  endHour: "19:00",
  slotDurationMinutes: 60,
  lunchStart: "12:00",
  lunchEnd: "13:00",
  closedDays: [0],
};

export class PostgreSQLDB {
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.init();
  }

  private async init() {
    console.log(
      "[POSTGRES] Conectando ao banco de dados Supabase via Prisma...",
    );
    try {
      // Cria a configuração inicial padrão se ela não existir no banco
      const configCount = await prisma.businessConfig.count();
      if (configCount === 0) {
        await prisma.businessConfig.create({
          data: {
            id: "main",
            startHour: DEFAULT_CONFIG.startHour,
            endHour: DEFAULT_CONFIG.endHour,
            slotDurationMinutes: DEFAULT_CONFIG.slotDurationMinutes,
            lunchStart: DEFAULT_CONFIG.lunchStart,
            lunchEnd: DEFAULT_CONFIG.lunchEnd,
            closedDays: JSON.stringify(DEFAULT_CONFIG.closedDays),
          },
        });
      }

      // Cria os usuários administradores iniciais se a tabela de usuários estiver vazia
      const userCount = await prisma.user.count();
      if (userCount === 0) {
        const adminHash = bcrypt.hashSync("Jesuino@AdminSec2026$", 10);
        const rodrigoHash = bcrypt.hashSync("Rodrigo@SecurePass2026!", 10);

        await prisma.user.createMany({
          data: [
            {
              id: "user-1",
              name: "Jesuino Admin",
              email: "admin@jesuinosbarbearia.com.br",
              password: adminHash,
            },
            {
              id: "user-2",
              name: "Rodrigo Pontes (Admin)",
              email: "rodrigopontes126@gmail.com",
              password: rodrigoHash,
            },
          ],
        });
      }
      console.log("[POSTGRES] Banco de dados inicializado e sincronizado!");
    } catch (error) {
      console.error("[POSTGRES] Erro ao inicializar tabelas iniciais:", error);
    }
  }

  public async ensureInitialized() {
    await this.initPromise;
  }

  public async getHealthInfo() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: "healthy",
        engine: "prisma-supabase",
      };
    } catch (err: any) {
      return {
        status: "unhealthy",
        engine: "prisma-error",
        error: err.message,
      };
    }
  }

  public async getBookings(): Promise<Booking[]> {
    const records = await prisma.agendamento.findMany({
      orderBy: [{ date: "asc" }, { time: "asc" }],
    });
    return records.map((r) => ({
      id: r.id,
      clientName: r.clientName,
      clientEmail: r.clientEmail,
      clientPhone: r.clientPhone,
      date: r.date,
      time: r.time,
      status: r.status as BookingStatus,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  public async getBookingById(id: string): Promise<Booking | undefined> {
    const r = await prisma.agendamento.findUnique({ where: { id } });
    if (!r) return undefined;
    return {
      id: r.id,
      clientName: r.clientName,
      clientEmail: r.clientEmail,
      clientPhone: r.clientPhone,
      date: r.date,
      time: r.time,
      status: r.status as BookingStatus,
      createdAt: r.createdAt.toISOString(),
    };
  }

  public async createBooking(
    booking: Omit<Booking, "id" | "createdAt">,
  ): Promise<Booking> {
    const id = `booking-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const r = await prisma.agendamento.create({
      data: {
        id,
        clientName: booking.clientName,
        clientEmail: booking.clientEmail,
        clientPhone: booking.clientPhone,
        date: booking.date,
        time: booking.time,
        status: booking.status,
      },
    });
    return {
      id: r.id,
      clientName: r.clientName,
      clientEmail: r.clientEmail,
      clientPhone: r.clientPhone,
      date: r.date,
      time: r.time,
      status: r.status as BookingStatus,
      createdAt: r.createdAt.toISOString(),
    };
  }

  public async updateBooking(
    id: string,
    updates: Partial<Omit<Booking, "id" | "createdAt">>,
  ): Promise<Booking | null> {
    try {
      const r = await prisma.agendamento.update({
        where: { id },
        data: {
          clientName: updates.clientName,
          clientEmail: updates.clientEmail,
          clientPhone: updates.clientPhone,
          date: updates.date,
          time: updates.time,
          status: updates.status,
        },
      });
      return {
        id: r.id,
        clientName: r.clientName,
        clientEmail: r.clientEmail,
        clientPhone: r.clientPhone,
        date: r.date,
        time: r.time,
        status: r.status as BookingStatus,
        createdAt: r.createdAt.toISOString(),
      };
    } catch {
      return null;
    }
  }

  public async deleteBooking(id: string): Promise<boolean> {
    try {
      await prisma.agendamento.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  public async getConfig(): Promise<BusinessConfig> {
    const r = await prisma.businessConfig.findUnique({ where: { id: "main" } });
    if (!r) return DEFAULT_CONFIG;
    return {
      startHour: r.startHour,
      endHour: r.endHour,
      slotDurationMinutes: r.slotDurationMinutes,
      lunchStart: r.lunchStart,
      lunchEnd: r.lunchEnd,
      closedDays: Array.isArray(r.closedDays)
        ? r.closedDays
        : JSON.parse(r.closedDays || "[]"),
    };
  }

  public async updateConfig(
    config: Partial<BusinessConfig>,
  ): Promise<BusinessConfig> {
    const current = await this.getConfig();
    const updated = { ...current, ...config };

    await prisma.businessConfig.update({
      where: { id: "main" },
      data: {
        startHour: updated.startHour,
        endHour: updated.endHour,
        slotDurationMinutes: updated.slotDurationMinutes,
        lunchStart: updated.lunchStart,
        lunchEnd: updated.lunchEnd,
        closedDays: JSON.stringify(updated.closedDays),
      },
    });
    return updated;
  }

  public async getUserByEmail(email: string): Promise<User | undefined> {
    const r = await prisma.user.findUnique({ where: { email } });
    if (!r) return undefined;
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      password: r.password,
      createdAt: r.createdAt.toISOString(),
    };
  }

  public async getUserById(id: string): Promise<User | undefined> {
    const r = await prisma.user.findUnique({ where: { id } });
    if (!r) return undefined;
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      password: r.password,
      createdAt: r.createdAt.toISOString(),
    };
  }

  public async createUser(user: Omit<User, "id" | "createdAt">): Promise<User> {
    const id = `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const r = await prisma.user.create({
      data: {
        id,
        name: user.name,
        email: user.email,
        password: user.password,
      },
    });
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      password: r.password,
      createdAt: r.createdAt.toISOString(),
    };
  }
}

export const db = new PostgreSQLDB();
