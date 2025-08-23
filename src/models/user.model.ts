import { Document, model, Schema } from "mongoose";

export interface IUser extends Document {
    isPremium: boolean;
    googleId: string;
    email: string;
    displayName: string;
    profilePicture: string;
    plan: "basic" | "premium" | "gold";
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
});

export default model<IUser>("User", UserSchema);
