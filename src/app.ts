import dotenv from "dotenv";
dotenv.config();

import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";
import passport from "passport";
import session from "express-session";
import MongoStore from "connect-mongo";
import "./config/passport"; // your passport config
import { alertService } from './services/alert.service';

// Routes
import authRoute from "./routes/auth";
import contractsRoute from "./routes/contracts";
import paymentsRoute from "./routes/payments";
import userRoutes from "./routes/user.routes";
import { handleWebHook } from "./controllers/payment.controller";

const app = express();

// Environment check
const isProduction = process.env.NODE_ENV === "production";
console.log("Environment:", process.env.NODE_ENV);
console.log("Client URL:", process.env.CLIENT_URL);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI!)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// IMPORTANT: Trust proxy - this is critical for Railway/Vercel
app.set('trust proxy', 1);


mongoose.connect(process.env.MONGODB_URI!)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    
    // Initialize alert service after successful DB connection
    setTimeout(() => {
      alertService.init();
      console.log("🔔 Alert service initialized");
    }, 2000); // Small delay to ensure everything is ready
  })
  .catch((err) => console.error("❌ MongoDB Error:", err));

  
app.use(
  cors({
    origin: process.env.CLIENT_URL, // Replace with your frontend URL
    credentials: true,
  })
);

// --- SECURITY + LOGGING ---
// Adjust helmet for cross-origin
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(morgan("dev"));

// --- STRIPE WEBHOOK FIRST (must use raw body) ---
app.post(
  "/payments/webhook",
  express.raw({ type: "application/json" }),
  handleWebHook
);

// --- BODY PARSING ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// IMPORTANT: Add MongoDB store for sessions
app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    // Add MongoDB store to persist sessions
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: "sessions",
    }),
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Debug endpoint
app.get("/debug", (req, res) => {
  res.json({
    authenticated: req.isAuthenticated(),
    sessionID: req.sessionID,
    session: req.session,
    user: req.user
  });
});

// --- ROUTES ---
app.use("/auth", authRoute);
app.use("/contracts", contractsRoute);
app.use("/payments", paymentsRoute);
app.use("/api/users", userRoutes);

// --- START SERVER ---
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`Mode: ${isProduction ? "Production" : "Development"}`);
});