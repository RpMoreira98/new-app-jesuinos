import bcrypt from 'bcryptjs';
import { pool } from './database';
import { Booking, BusinessConfig, BookingStatus, User } from '../types';

// Get current date relative to system time
const getFutureDateString = (daysAhead: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
};

const DEFAULT_CONFIG: BusinessConfig = {
  startHour: "08:00",
  endHour: "19:00",
  slotDurationMinutes: 60,
  lunchStart: "12:00",
  lunchEnd: "13:00",
  closedDays: [0], // Sunday is closed
};

const getDefaultBookings = (): Booking[] => [
  {
    id: "booking-1",
    clientName: "Rodrigo Pontes",
    clientEmail: "rodrigopontes126@gmail.com",
    clientPhone: "+55 88 99111-2222",
    date: getFutureDateString(0), // Today
    time: "14:00",
    status: "pending",
    createdAt: new Date().toISOString(),
  },
  {
    id: "booking-2",
    clientName: "Carlos Silva",
    clientEmail: "carlossilva@email.com",
    clientPhone: "+55 88 98888-7777",
    date: getFutureDateString(1), // Tomorrow
    time: "10:00",
    status: "approved",
    createdAt: new Date().toISOString(),
  }
];

// Mapper functions
const mapConfigFromPg = (r: any): BusinessConfig => {
  if (!r) return DEFAULT_CONFIG;
  return {
    startHour: r.start_hour,
    endHour: r.end_hour,
    slotDurationMinutes: r.slot_duration_minutes,
    lunchStart: r.lunch_start || null,
    lunchEnd: r.lunch_end || null,
    closedDays: Array.isArray(r.closed_days) ? r.closed_days : JSON.parse(r.closed_days || '[]')
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
  createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at
});

const mapUserFromPg = (r: any): User => ({
  id: r.id,
  name: r.name,
  email: r.email,
  password: r.password,
  createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at
});

export class PostgreSQLDB {
  private initPromise: Promise<void>;
  private useFallback = false;

  // Fallback memory state (used if DATABASE_URL is not set or PostgreSQL connection fails)
  private fallbackConfig: BusinessConfig = DEFAULT_CONFIG;
  private fallbackBookings: Booking[] = getDefaultBookings();
  private fallbackUsers: User[] = [];

  constructor() {
    this.initPromise = this.init();
  }

  private async init() {
    const hasDbUrl = !!process.env.DATABASE_URL;

    if (!hasDbUrl) {
      console.warn('[POSTGRES] DATABASE_URL não está configurada. Ativando Modo Fallback Recipiente em Memória para visualização imediata!');
      this.activateFallback();
      return;
    }

    try {
      console.log('[POSTGRES] Testando conexão com o pool PostgreSQL...');
      // Brief connection test
      await pool.query('SELECT 1');
      console.log('[POSTGRES] Conectado com sucesso! Inicializando tabelas de dados no PostgreSQL (Supabase)...');

      // 1. Create table business_config
      await pool.query(`
        CREATE TABLE IF NOT EXISTS business_config (
          id TEXT PRIMARY KEY,
          start_hour TEXT NOT NULL,
          end_hour TEXT NOT NULL,
          slot_duration_minutes INTEGER NOT NULL,
          lunch_start TEXT,
          lunch_end TEXT,
          closed_days JSONB NOT NULL
        )
      `);

      // 2. Create table bookings
      await pool.query(`
        CREATE TABLE IF NOT EXISTS bookings (
          id TEXT PRIMARY KEY,
          client_name TEXT NOT NULL,
          client_email TEXT NOT NULL,
          client_phone TEXT NOT NULL,
          date TEXT NOT NULL,
          time TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL
        )
      `);

      // 3. Create table users (for JWT Auth)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL
        )
      `);

      // 4. Seed default config if empty
      const configCountRes = await pool.query('SELECT COUNT(*) as count FROM business_config');
      if (parseInt(configCountRes.rows[0].count, 10) === 0) {
        await pool.query(`
          INSERT INTO business_config (id, start_hour, end_hour, slot_duration_minutes, lunch_start, lunch_end, closed_days)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          'main',
          DEFAULT_CONFIG.startHour,
          DEFAULT_CONFIG.endHour,
          DEFAULT_CONFIG.slotDurationMinutes,
          DEFAULT_CONFIG.lunchStart,
          DEFAULT_CONFIG.lunchEnd,
          JSON.stringify(DEFAULT_CONFIG.closedDays)
        ]);
        console.log('[POSTGRES] Configuração padrão da barbearia semeada.');
      }

      // 5. Seed default bookings if empty
      const bookingCountRes = await pool.query('SELECT COUNT(*) as count FROM bookings');
      if (parseInt(bookingCountRes.rows[0].count, 10) === 0) {
        const defaults = getDefaultBookings();
        for (const b of defaults) {
          await pool.query(`
            INSERT INTO bookings (id, client_name, client_email, client_phone, date, time, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [b.id, b.clientName, b.clientEmail, b.clientPhone, b.date, b.time, b.status, b.createdAt]);
        }
        console.log('[POSTGRES] Agendamentos de testes semeados.');
      }

      // 6. Seed/Upsert default admin users with strong passwords to guarantee access
      const adminHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'Jesuino@AdminSec2026$', 10);
      const rodrigoHash = bcrypt.hashSync(process.env.RODRIGO_PASSWORD || 'Rodrigo@SecurePass2026!', 10);

      // Upsert admin user
      const adminCheck = await pool.query('SELECT * FROM users WHERE email = $1', ['admin@jesuinosbarbearia.com.br']);
      if (adminCheck.rows.length === 0) {
        await pool.query(`
          INSERT INTO users (id, name, email, password, created_at)
          VALUES ($1, $2, $3, $4, $5)
        `, ['user-1', 'Jesuino Admin', 'admin@jesuinosbarbearia.com.br', adminHash, new Date().toISOString()]);
      } else {
        await pool.query(`
          UPDATE users SET password = $1 WHERE email = $2
        `, [adminHash, 'admin@jesuinosbarbearia.com.br']);
      }

      // Upsert rodrigo user
      const rodrigoCheck = await pool.query('SELECT * FROM users WHERE email = $1', ['rodrigopontes126@gmail.com']);
      if (rodrigoCheck.rows.length === 0) {
        await pool.query(`
          INSERT INTO users (id, name, email, password, created_at)
          VALUES ($1, $2, $3, $4, $5)
        `, ['user-2', 'Rodrigo Pontes (Admin)', 'rodrigopontes126@gmail.com', rodrigoHash, new Date().toISOString()]);
      } else {
        await pool.query(`
          UPDATE users SET password = $1 WHERE email = $2
        `, [rodrigoHash, 'rodrigopontes126@gmail.com']);
      }
      
      console.log('[POSTGRES] Administradores sincronizados com sucesso.');

      console.log('[POSTGRES] Conexão e sincronização realizada perfeitamente!');
    } catch (error) {
      console.warn('[POSTGRES] Conexão com PostgreSQL falhou ou está instável. Erro:', error);
      console.log('[POSTGRES] Ativando Modo Fallback Resiliente em Memória para o ambiente de demonstração!');
      this.activateFallback();
    }
  }

  private activateFallback() {
    this.useFallback = true;
    
    // Seed fallback users so admin login is always available
    const adminHash = bcrypt.hashSync('Jesuino@AdminSec2026$', 10);
    const rodrigoHash = bcrypt.hashSync('Rodrigo@SecurePass2026!', 10);

    this.fallbackUsers = [
      {
        id: 'user-1',
        name: 'Jesuino Admin',
        email: 'admin@jesuinosbarbearia.com.br',
        password: adminHash,
        createdAt: new Date().toISOString()
      },
      {
        id: 'user-2',
        name: 'Rodrigo Pontes (Admin)',
        email: 'rodrigopontes126@gmail.com',
        password: rodrigoHash,
        createdAt: new Date().toISOString()
      }
    ];
  }

  public async ensureInitialized() {
    await this.initPromise;
  }

  // Diagnostic health status
  public async getHealthInfo() {
    try {
      await this.ensureInitialized();
      if (this.useFallback) {
        return {
          status: "healthy",
          engine: "memory-fallback",
          stats: {
            configCount: 1,
            bookingsCount: this.fallbackBookings.length
          }
        };
      }

      const configCountRes = await pool.query('SELECT COUNT(*) as count FROM business_config');
      const bookingsCountRes = await pool.query('SELECT COUNT(*) as count FROM bookings');
      return {
        status: "healthy",
        engine: "postgresql",
        stats: {
          configCount: parseInt(configCountRes.rows[0].count, 10),
          bookingsCount: parseInt(bookingsCountRes.rows[0].count, 10)
        }
      };
    } catch (err: any) {
      return {
        status: "unhealthy",
        engine: "postgresql-failing",
        error: err.message
      };
    }
  }

  // Bookings Methods
  public async getBookings(): Promise<Booking[]> {
    await this.ensureInitialized();
    if (this.useFallback) {
      return [...this.fallbackBookings].sort((a, b) => {
        const diff = a.date.localeCompare(b.date);
        if (diff !== 0) return diff;
        return a.time.localeCompare(b.time);
      });
    }

    const res = await pool.query('SELECT * FROM bookings ORDER BY date ASC, time ASC');
    return res.rows.map(mapBookingFromPg);
  }

  public async getBookingById(id: string): Promise<Booking | undefined> {
    await this.ensureInitialized();
    if (this.useFallback) {
      return this.fallbackBookings.find(b => b.id === id);
    }

    const res = await pool.query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (res.rows.length === 0) return undefined;
    return mapBookingFromPg(res.rows[0]);
  }

  public async createBooking(booking: Omit<Booking, 'id' | 'createdAt'>): Promise<Booking> {
    await this.ensureInitialized();
    const id = `booking-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const createdAt = new Date().toISOString();

    if (this.useFallback) {
      const newB: Booking = { ...booking, id, createdAt };
      this.fallbackBookings.push(newB);
      return newB;
    }

    await pool.query(`
      INSERT INTO bookings (id, client_name, client_email, client_phone, date, time, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [id, booking.clientName, booking.clientEmail, booking.clientPhone, booking.date, booking.time, booking.status, createdAt]);
    return {
      ...booking,
      id,
      createdAt
    };
  }

  public async updateBooking(id: string, updates: Partial<Omit<Booking, 'id' | 'createdAt'>>): Promise<Booking | null> {
    await this.ensureInitialized();
    const current = await this.getBookingById(id);
    if (!current) return null;
    const updated = { ...current, ...updates };

    if (this.useFallback) {
      this.fallbackBookings = this.fallbackBookings.map(b => b.id === id ? updated : b);
      return updated;
    }

    await pool.query(`
      UPDATE bookings 
      SET client_name = $1, client_email = $2, client_phone = $3, date = $4, time = $5, status = $6
      WHERE id = $7
    `, [
      updated.clientName,
      updated.clientEmail,
      updated.clientPhone,
      updated.date,
      updated.time,
      updated.status,
      id
    ]);
    return updated;
  }

  public async deleteBooking(id: string): Promise<boolean> {
    await this.ensureInitialized();
    if (this.useFallback) {
      const originalLength = this.fallbackBookings.length;
      this.fallbackBookings = this.fallbackBookings.filter(b => b.id !== id);
      return this.fallbackBookings.length < originalLength;
    }

    const res = await pool.query('DELETE FROM bookings WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  // Business Config Methods
  public async getConfig(): Promise<BusinessConfig> {
    await this.ensureInitialized();
    if (this.useFallback) {
      return this.fallbackConfig;
    }

    const res = await pool.query('SELECT * FROM business_config WHERE id = $1', ['main']);
    if (res.rows.length === 0) return DEFAULT_CONFIG;
    return mapConfigFromPg(res.rows[0]);
  }

  public async updateConfig(config: Partial<BusinessConfig>): Promise<BusinessConfig> {
    await this.ensureInitialized();
    const current = await this.getConfig();
    const updated = { ...current, ...config };

    if (this.useFallback) {
      this.fallbackConfig = updated;
      return updated;
    }

    await pool.query(`
      UPDATE business_config
      SET start_hour = $1, end_hour = $2, slot_duration_minutes = $3, lunch_start = $4, lunch_end = $5, closed_days = $6
      WHERE id = $7
    `, [
      updated.startHour,
      updated.endHour,
      updated.slotDurationMinutes,
      updated.lunchStart,
      updated.lunchEnd,
      JSON.stringify(updated.closedDays),
      'main'
    ]);
    return updated;
  }

  // User Methods (needed for Auth integration)
  public async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      await this.ensureInitialized();
      if (this.useFallback) {
        return this.fallbackUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
      }

      const res = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
      if (res.rows.length === 0) return undefined;
      return mapUserFromPg(res.rows[0]);
    } catch (err) {
      console.error('[POSTGRES] Error getting user by email:', err);
      return undefined;
    }
  }

  public async getUserById(id: string): Promise<User | undefined> {
    try {
      await this.ensureInitialized();
      if (this.useFallback) {
        return this.fallbackUsers.find(u => u.id === id);
      }

      const res = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      if (res.rows.length === 0) return undefined;
      return mapUserFromPg(res.rows[0]);
    } catch (err) {
      console.error('[POSTGRES] Error getting user by id:', err);
      return undefined;
    }
  }

  public async createUser(user: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    await this.ensureInitialized();
    const id = `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const createdAt = new Date().toISOString();

    if (this.useFallback) {
      const newU: User = { ...user, id, createdAt };
      this.fallbackUsers.push(newU);
      return newU;
    }

    await pool.query(`
      INSERT INTO users (id, name, email, password, created_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [id, user.name, user.email, user.password, createdAt]);
    return {
      id,
      name: user.name,
      email: user.email,
      password: user.password,
      createdAt
    };
  }
}

export const db = new PostgreSQLDB();
