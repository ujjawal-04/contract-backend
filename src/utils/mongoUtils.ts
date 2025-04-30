import mongoose from "mongoose";

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