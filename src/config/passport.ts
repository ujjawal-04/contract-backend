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

// Log environment information for debugging
console.log('Passport initialization:');
console.log('Google callback URL:', process.env.GOOGLE_CALLBACK_URL);
console.log('Environment:', process.env.NODE_ENV);

// Passport Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!,
      // Add proxy option for production environments
      proxy: process.env.NODE_ENV === 'production'
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log('Google auth attempt for profile:', profile.id);
        
        let user = await User.findOne({ googleId: profile.id });
        
        if (!user) {
          console.log('Creating new user from Google profile');
          // If user not found, create a new one
          user = await User.create({
            googleId: profile.id,
            email: profile.emails![0].value,
            displayName: profile.displayName,
            profilePicture: profile.photos![0].value,
          });
        } else {
          console.log('Found existing user:', user._id);
        }
        
        // Convert Mongoose document to plain object
        const userDoc = user as any;
        
        // Create a user object to be used in Express session
        const userForAuth: Express.User = {
          _id: safeIdToString(userDoc._id),
          email: userDoc.email,
          displayName: userDoc.displayName,
          isPremium: userDoc.isPremium,
          profilePicture: userDoc.profilePicture,
        };
        
        console.log('Authentication successful, user ID:', userForAuth._id);
        done(null, userForAuth); // Return user info
      } catch (error) {
        console.error('Google authentication error:', error);
        done(error as Error, undefined); // Handle errors
      }
    }
  )
);

// Serialize User
passport.serializeUser((user: Express.User, done) => {
  console.log('Serializing user:', user._id);
  done(null, user._id); // Store only user _id in session
});

// Deserialize User
passport.deserializeUser(async (id: string, done) => {
  try {
    console.log('Deserializing user ID:', id);
    const user = await User.findById(id);
    
    if (!user) {
      console.log('User not found during deserialization:', id);
      return done(null, null); // User not found, clear session
    }
    
    const userDoc = user as any; // Cast to 'any' to avoid TypeScript errors
    
    // Create a user object for session (to match Express.User)
    const userForAuth: Express.User = {
      _id: safeIdToString(userDoc._id),
      email: userDoc.email,
      displayName: userDoc.displayName,
      isPremium: userDoc.isPremium,
      profilePicture: userDoc.profilePicture,
    };
    
    done(null, userForAuth); // Return user info
  } catch (error) {
    console.error('Deserialization error:', error);
    done(error as Error, null); // Handle any errors
  }
});

export default passport;