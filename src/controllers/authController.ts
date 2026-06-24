import { Request, Response } from 'express';
import { AuthService } from '../services/authService';

/**
 * Controller containing API route handlers for JWT authentication.
 */
export class AuthController {
  /**
   * Action: Standard user login checks.
   * POST /api/auth/login
   */
  public static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Os campos de email e senha são obrigatórios.' });
      }

      // Delegate business orchestration to AuthService
      const result = await AuthService.authenticate(email, password);

      return res.status(200).json({
        message: 'Autenticação bem-sucedida! Bem-vindo(a).',
        token: result.token,
        user: result.user
      });
    } catch (err: any) {
      return res.status(401).json({ error: err.message || 'Falha na autenticação.' });
    }
  }

  /**
   * Action: Handles creation of new user records.
   * POST /api/auth/register
   */
  public static async register(req: Request, res: Response) {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Os campos de nome, email e senha são obrigatórios.' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'A senha deve conter no mínimo 6 caracteres.' });
      }

      // Delegate register orchestration to AuthService
      const user = await AuthService.register(name, email, password);

      return res.status(201).json({
        message: 'Usuário cadastrado com sucesso!',
        user
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Erro ao processar criação de conta.' });
    }
  }

  /**
   * Action: Handles stateless logout confirmation.
   * Pure stateless JWT systems are destroyed on the client level by cleaning 
   * the environment token storage (e.g. localStorage/Cookies). 
   * POST /api/auth/logout
   */
  public static async logout(req: Request, res: Response) {
    return res.status(200).json({
      message: 'Sessão finalizada. Lembre-se de deletar as chaves de storage correspondentes no lado do cliente.'
    });
  }

  /**
   * Action: Secure route verifying decoded session attributes from req.user
   * GET /api/auth/me
   */
  public static async me(req: Request, res: Response) {
    // req.user was attached previously during the authMiddleware interception
    if (!req.user) {
      return res.status(401).json({ error: 'Usuário não identificado nesta sessão.' });
    }

    return res.status(200).json({
      message: 'Status de autorização com prestígio concedido!',
      user: req.user
    });
  }
}
