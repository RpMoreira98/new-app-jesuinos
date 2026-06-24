import { Pool } from 'pg';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('[POSTGRES] Warning: DATABASE_URL is not set. Database operations might fail.');
}

export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});
