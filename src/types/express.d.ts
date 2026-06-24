import { OmitPasswordUser } from '../types';

// Augments the Express interface namespace to support adding the authenticated user to req.user
declare global {
  namespace Express {
    interface Request {
      user?: OmitPasswordUser;
    }
  }
}
