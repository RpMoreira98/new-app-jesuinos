import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../server/storage';
import { jwtConfig } from '../config/jwt';
import { User, OmitPasswordUser } from '../types';

/**
 * Authentication and Token Management Service.
 * Separates core cryptographic actions and DB lookup orchestrations from controllers.
 */
export class AuthService {
  /**
   * Generates a signed JWT for the user.
   * @param user User object (excluding the sensitive password field)
   */
  public static generateToken(user: OmitPasswordUser): string {
    const payload = {
      sub: user.id,
      name: user.name,
      email: user.email,
    };
    return jwt.sign(payload, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn as any });
  }

  /**
   * Verifies the authenticity and signature of a JWT token.
   * @param token Bearer authentication token
   */
  public static verifyToken(token: string): any {
    try {
      return jwt.verify(token, jwtConfig.secret);
    } catch (err) {
      return null;
    }
  }

  /**
   * Authenticates a user by email and password.
   * Returns the JWT token and basic user data if successful, otherwise throws a clear error.
   */
  public static async authenticate(email: string, password: string): Promise<{ token: string; user: OmitPasswordUser }> {
    const user = await db.getUserByEmail(email);
    if (!user) {
      throw new Error('Usuário não encontrado.');
    }

    // Compare raw password with stored hash
    const passwordMatch = await bcrypt.compare(password, user.password || '');
    if (!passwordMatch) {
      throw new Error('Senha incorreta.');
    }

    // Exclude password from the returned object
    const { password: _, ...userWithoutPassword } = user;
    const token = this.generateToken(userWithoutPassword);

    return { token, user: userWithoutPassword };
  }

  /**
   * Registers a new user. Hashes the password first and stores it in the database.
   */
  public static async register(name: string, email: string, password: string): Promise<OmitPasswordUser> {
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      throw new Error('Este email já está cadastrado.');
    }

    // Hash user password with solid salt grounds (10 rounds)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await db.createUser({
      name,
      email,
      password: hashedPassword,
    });

    const { password: _, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }
}
