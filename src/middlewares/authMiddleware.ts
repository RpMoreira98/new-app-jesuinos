import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { db } from '../server/storage';

/**
 * Middleware to protect secure paths in the system.
 * Validates the authorization header and injects the user context into the req object if correct.
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: 'Token de autenticação não fornecido no cabeçalho.' });
    }

    // Ensure format matches: Bearer <TOKEN>
    const parts = authHeader.split(' ');
    if (parts.length !== 2) {
      return res.status(401).json({ error: 'Token fora do formato esperado. Deve usar o padrão: Bearer <TOKEN>' });
    }

    const [scheme, token] = parts;
    if (!/^Bearer$/i.test(scheme)) {
      return res.status(401).json({ error: 'Prefixo de token mal formatado. Deve iniciar com Bearer.' });
    }

    // Verify cryptographic signature of the token
    const decoded = AuthService.verifyToken(token);
    if (!decoded || !decoded.sub) {
      return res.status(401).json({ error: 'Token de autenticação inválido, corrompido ou expirado.' });
    }

    // Retrieve active database record to verify the user exists
    const user = await db.getUserById(decoded.sub);
    if (!user) {
      return res.status(401).json({ error: 'O usuário associado a este token não existe no sistema.' });
    }

    // Omit the password hash before attaching to req
    const { password: _, ...userWithoutPassword } = user;
    
    // Injects the clean user context into request
    req.user = userWithoutPassword;

    return next();
  } catch (error: any) {
    console.error('[AUTH MIDDLEWARE] Error in authentication check:', error);
    return res.status(401).json({ error: 'Processamento falhou durante a validação da sessão.' });
  }
}
export default authMiddleware;
