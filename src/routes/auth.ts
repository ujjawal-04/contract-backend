import express from 'express';
import passport from 'passport';

// Create the router
const router = express.Router();

// Simple debug endpoint
router.get('/debug-session', (req, res) => {
  console.log('Session debug:', {
    isAuthenticated: req.isAuthenticated(),
    sessionID: req.sessionID,
    session: req.session
  });
  
  res.json({
    isAuthenticated: req.isAuthenticated(),
    sessionID: req.sessionID,
    user: req.user
  });
});

// Google OAuth routes
router.get(
  "/google",
  passport.authenticate("google", { 
    scope: ["profile", "email"] 
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { 
    failureRedirect: "/login" 
  }),
  (req, res) => {
    // Log successful authentication
    console.log('Auth successful - redirecting');
    
    res.redirect(`${process.env.CLIENT_URL}/dashboard`);
  }
);

// Current user endpoint
router.get("/current-user", (req, res) => {
  console.log('Current user request, authenticated:', req.isAuthenticated());
  
  if (req.isAuthenticated()) {
    // Return user without sensitive data
    const userObj = req.user;
    res.json(userObj);
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
});

// Logout route
router.get("/logout", (req, res) => {
  req.logout(function(err) {
    if (err) { 
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' }); 
    }
    
    req.session.destroy(() => {
      res.clearCookie("connect.sid", {
        path: "/",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        secure: process.env.NODE_ENV === "production",
      });
      
      res.status(200).json({ message: "Logged out successfully" });
    });
  });
});

export default router;