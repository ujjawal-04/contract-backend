// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';

// With Passport.js, the user is automatically attached to req.user
// Extend Express Request to include proper typing for the user
declare global {
  namespace Express {
    interface User {
      _id: string;
      email: string;
      displayName: string;
      isPremium?: boolean;
      profilePicture?: string;
    }
  }
}

// Simple middleware to check if user is authenticated
export const isAuthenticated = (req: Request, res: Response, next: NextFunction): void => {
  if (req.isAuthenticated()) {
    next();
    return;
  }
  
  res.status(401).json({ success: false, message: 'Not authenticated. Please login.' });
};