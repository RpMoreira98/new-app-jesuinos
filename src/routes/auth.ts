import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

/**
 * Public Authentication Routes
 */
// Handle credential login and send signed token back
router.post('/login', AuthController.login);

// Handle new user registrations
router.post('/register', AuthController.register);

// Simulator to clear authorization signals
router.post('/logout', AuthController.logout);

/**
 * Protected Routes (Guarded by authMiddleware)
 */
// Fetch profile properties extracted from token
router.get('/me', authMiddleware, AuthController.me);

export default router;
