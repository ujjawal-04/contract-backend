import passport from 'passport';
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User, { IUser } from "../models/user.model";

// Helper function to safely convert _id to string regardless of its type
function safeIdToString(id: any): string {
  if (id === null || id === undefined) {
    throw new Error('ID is null or undefined');
  }
  // Handle different possible formats of _id
  if (typeof id === 'string') {
    return id;
  }
  if (typeof id === 'object' && id !== null && typeof id.toString === 'function') {
    return id.toString();
  }
  return String(id);
}

passport.use(
  new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: process.env.GOOGLE_CALLBACK_URL!,
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ googleId: profile.id });
      
      if(!user) {
        user = await User.create({
          googleId: profile.id,
          email: profile.emails![0].value,
          displayName: profile.displayName,
          profilePicture: profile.photos![0].value,
        });
      }
      
      // Cast to any first to avoid TypeScript errors, then convert properties safely
      const userDoc = user as any;
      
      // Convert Mongoose document to plain object for Express.User
      const userForAuth: Express.User = {
        _id: safeIdToString(userDoc._id),
        email: userDoc.email,
        displayName: userDoc.displayName,
        isPremium: userDoc.isPremium,
        profilePicture: userDoc.profilePicture
      };
      
      done(null, userForAuth);
    } catch (error) {
      done(error as Error, undefined)
    }
  })
);

passport.serializeUser((user: Express.User, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id);
    
    if (!user) {
      return done(null, null);
    }
    
    // Cast to any first to avoid TypeScript errors, then convert properties safely
    const userDoc = user as any;
    
    // Convert Mongoose document to plain object for Express.User
    const userForAuth: Express.User = {
      _id: safeIdToString(userDoc._id),
      email: userDoc.email,
      displayName: userDoc.displayName,
      isPremium: userDoc.isPremium,
      profilePicture: userDoc.profilePicture
    };
    
    done(null, userForAuth);
  } catch (error) {
    done(error as Error, null);
  }
});