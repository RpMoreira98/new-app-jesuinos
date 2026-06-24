import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

/**
 * JWT Configuration.
 * Reads configurations from environment variables with a safe fallback for development.
 */
export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'jesuinos_backup_ultra_secure_jwt_secret_token_key_2026',
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
};
