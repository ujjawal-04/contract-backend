import dotenv from "dotenv"
dotenv.config();
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";
import passport from "passport";
import session from "express-session";
import MongoStore from "connect-mongo";
import "./config/passport";
import { connectToDatabase } from "./config/db";

// routes
import authRoute from "./routes/auth";
import contractsRoute from "./routes/contracts";
import paymentsRoute from "./routes/payments";
import userRoutes from "./routes/user.routes";
import { handleWebHook } from "./controllers/payment.controller";

const app = express();

// Initialize the app and start the server only after DB connection
const startServer = async () => {
  try {
    // First connect to the database
    await connectToDatabase();
    
    // Set up middleware
    app.use(cors({
      origin: process.env.CLIENT_URL,
      credentials: true,
    }));
    
    app.use(helmet());
    app.use(morgan("dev"));
    
    // Raw body parser for Stripe webhook
    app.post(
      "/payments/webhook",
      express.raw({ type: "application/json" }),
      handleWebHook
    );
    
    app.use(express.json());
    
    // Session configuration with simplified options
    app.use(session({
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({ 
        mongoUrl: process.env.MONGODB_URI!,
        // Minimal options for MongoStore
        mongoOptions: {
          serverSelectionTimeoutMS: 30000,
          socketTimeoutMS: 45000
        }
      }),
      cookie: {
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    }));
    
    app.use(passport.initialize());
    app.use(passport.session());
    
    // Add a health check endpoint
    app.get("/health", (req, res) => {
      res.status(200).json({
        status: "ok",
        mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
      });
    });
    
    // Mount routes
    app.use("/auth", authRoute);
    app.use("/contracts", contractsRoute);
    app.use("/payments", paymentsRoute);
    app.use("/api/users", userRoutes);
    
    // Use the PORT from environment variables
    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to initialize application:", error);
    process.exit(1);
  }
};

// Start the application
startServer();

// Handle unexpected errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});