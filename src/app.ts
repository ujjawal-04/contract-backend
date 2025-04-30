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

// routes
import authRoute from "./routes/auth";
import contractsRoute from "./routes/contracts";
import paymentsRoute from "./routes/payments";
import userRoutes from "./routes/user.routes";
import { handleWebHook } from "./controllers/payment.controller";

const app = express();

// Increase the MongoDB operation timeout and set buffer commands to false
mongoose.set('bufferCommands', false); // Disable command buffering

// Updated MongoDB connection with proper SSL/TLS options and longer timeout
const connectToMongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI!, {
      ssl: true,
      tls: true,
      serverSelectionTimeoutMS: 30000, // Increase timeout to 30 seconds
      socketTimeoutMS: 45000, // Increase socket timeout
      connectTimeoutMS: 30000, // Increase connect timeout
      heartbeatFrequencyMS: 10000, // More frequent heartbeats
      retryWrites: true,
      w: 'majority'
    });
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    
    // In production, exit the process and let the container restart
    if (process.env.NODE_ENV === 'production') {
      console.error("Connection failed, exiting process to allow container restart");
      process.exit(1);
    } else {
      // In development, retry after a delay
      console.log("Retrying connection in 5 seconds...");
      setTimeout(connectToMongoDB, 5000);
    }
  }
};

// Wait for database connection before starting the server
const startServer = async () => {
  try {
    // Connect to MongoDB first
    await connectToMongoDB();
    
    // Middleware setup
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
    
    // Standard body parser for all other routes
    app.use(express.json());
    
    // Session configuration with updated MongoStore options
    app.use(session({
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({ 
        mongoUrl: process.env.MONGODB_URI!,
        mongoOptions: {
          ssl: true,
          tls: true,
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
    
    // Mount routes
    app.use("/auth", authRoute);
    app.use("/contracts", contractsRoute);
    app.use("/payments", paymentsRoute);
    app.use("/api/users", userRoutes);
    
    // Health check endpoint
    app.get("/health", (req, res) => {
      res.status(200).json({ 
        status: "ok", 
        mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected" 
      });
    });
    
    // Use the PORT from environment variables if available
    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
    
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Set up MongoDB connection event handlers
mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected");
  if (process.env.NODE_ENV === 'production') {
    console.error("MongoDB disconnected in production. Exiting process to allow container restart");
    process.exit(1);
  }
});

// Start the server
startServer();