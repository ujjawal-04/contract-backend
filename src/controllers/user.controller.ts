// src/controllers/user.controller.ts
import { Request, Response, NextFunction } from 'express';
import User from '../models/user.model';

// Update the type definition to include NextFunction for Express compatibility
export const deleteAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // With Passport.js, the authenticated user is available on req.user
    if (!req.user || !req.user._id) {
      res.status(401).json({ success: false, message: 'Unauthorized: User not authenticated' });
      return;
    }
    
    // Find and delete the user
    const userId = req.user._id;
    const deletedUser = await User.findByIdAndDelete(userId);
    
    if (!deletedUser) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    
    // Use a Promise-based approach for logout
    await new Promise<void>((resolve, reject) => {
      req.logout((err) => {
        if (err) {
          console.error('Logout error:', err);
          reject(err);
          return;
        }
        resolve();
      });
    });
    
    // Destroy the session with Promise
    await new Promise<void>((resolve) => {
      req.session.destroy(() => {
        // Clear the session cookie
        res.clearCookie("connect.sid", {
          path: "/",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
          secure: process.env.NODE_ENV === "production",
        });
        resolve();
      });
    });
    
    // Return success response
    res.status(200).json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete account', 
      error: (error as Error).message 
    });
  }
};

export default {
  deleteAccount
};