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
      plan?: "basic" | "premium" | "gold";
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

// Middleware to check if user has premium access (Premium or Gold)
export const isPremiumUser = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ success: false, message: 'Not authenticated. Please login.' });
    return;
  }
  
  const user = req.user as Express.User;
  if (user.isPremium || user.plan === "premium" || user.plan === "gold") {
    next();
    return;
  }
  
  res.status(403).json({ 
    success: false, 
    message: 'Premium subscription required. Please upgrade your plan.' 
  });
};

// Middleware to check if user has gold access
export const isGoldUser = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ success: false, message: 'Not authenticated. Please login.' });
    return;
  }
  
  const user = req.user as Express.User;
  if (user.plan === "gold") {
    next();
    return;
  }
  
  res.status(403).json({ 
    success: false, 
    message: 'Gold subscription required. Please upgrade to Gold plan.' 
  });
};