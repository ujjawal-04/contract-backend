import { Document, model, Schema } from "mongoose";

export interface IUser extends Document {
    googleId: string;
    email: string;
    displayName: string;
    profilePicture: string;
    plan: "basic" | "premium" | "gold";
    isPremium: boolean; // Keep for backward compatibility, but make it a virtual field
}

const UserSchema = new Schema<IUser>({
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },
    profilePicture: { type: String },
    plan: { 
        type: String, 
        enum: ["basic", "premium", "gold"], 
        default: "basic" 
    },
}, {
    timestamps: true // Add createdAt and updatedAt timestamps
});

// Virtual field for backward compatibility
// This ensures isPremium is true for both premium and gold plans
UserSchema.virtual('isPremium').get(function() {
    return this.plan === "premium" || this.plan === "gold";
});

// Ensure virtual fields are included when converting to JSON
UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });

// Add indexes for better performance
UserSchema.index({ googleId: 1 });
UserSchema.index({ email: 1 });

export default model<IUser>("User", UserSchema);