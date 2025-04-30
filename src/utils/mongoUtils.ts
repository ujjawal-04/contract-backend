import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Your existing function
export function isvalidMongoId(id: string): boolean {
  // First try the built-in validation
  if (mongoose.Types.ObjectId.isValid(id)) {
    return true;
  }
   
  // Fallback for 26-character IDs (which some systems might use)
  if (id.length === 26 && /^[0-9a-fA-F]+$/.test(id)) {
    return true;
  }
   
  return false;
}

// Get MongoDB URI from environment variables
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not defined in environment variables");
  // Don't exit here - let the application handle this error
}

// Add new function to connect to MongoDB with proper SSL/TLS options
export const connectToDatabase = async (): Promise<void> => {
  try {
    if (!MONGODB_URI) {
      throw new Error("MongoDB URI is not defined");
    }

    // Connection options with proper SSL/TLS configuration
    // Using only properties that exist in ConnectOptions type
    await mongoose.connect(MONGODB_URI, {
      ssl: true,
      tls: true,
      // These can be enabled if needed, but should be avoided in production
      // tlsAllowInvalidCertificates: false,
      // tlsAllowInvalidHostnames: false,
    });

    console.log("Successfully connected to MongoDB Atlas");

    // Set up event listeners for the connection
    mongoose.connection.on("error", (err) => {
      console.error("MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB disconnected");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("MongoDB reconnected");
    });
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    throw error;
  }
};

// Function to close the database connection gracefully
export const closeDatabaseConnection = async (): Promise<void> => {
  await mongoose.connection.close();
  console.log("MongoDB connection closed");
};