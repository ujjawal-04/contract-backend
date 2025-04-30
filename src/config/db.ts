// src/config/db.ts
import mongoose from 'mongoose';

// Function to connect to MongoDB
export const connectToDatabase = async (): Promise<void> => {
  try {
    console.log('Attempting to connect to MongoDB...');
    
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    
    // Connect with minimal options
    await mongoose.connect(uri, {
      // These are the only options you should need
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000
    });
    
    console.log('Connected to MongoDB successfully!');
    
    // Set up connection event handlers
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
    });
    
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
};