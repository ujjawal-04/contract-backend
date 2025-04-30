import { Request, Response } from "express"; 
import User, { IUser } from "../models/user.model"; 
import Stripe from "stripe"; 
import { sendPremiumConfirmationEmail } from "../services/email.service";  

// Use the exact API version that TypeScript expects
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {     
  apiVersion: "2025-03-31.basil" 
});  

export const createCheckoutSession = async (req: Request, res: Response) => {     
  // Type the user correctly
  // Mongoose's Document type includes _id, but we need to be explicit about it having toString()
  const user = req.user as IUser & { _id: { toString(): string } };
  
  try {         
    const session = await stripe.checkout.sessions.create({             
      payment_method_types: ["card"],             
      line_items: [                 
        {                     
          price_data: {                         
            currency: "usd",                         
            product_data: {                             
              name: "Lifetime Subscription",                         
            },                         
            unit_amount: 1000,                     
          },                     
          quantity: 1,                 
        },             
      ],             
      customer_email: user.email,             
      mode: "payment",             
      success_url: `${process.env.CLIENT_URL}/payment-success`,             
      cancel_url: `${process.env.CLIENT_URL}/payment-cancel`,             
      client_reference_id: user._id.toString(),         
    });                  
    
    res.json({ sessionId: session.id });     
  } catch (error) {      
    console.error(error);      
    res.status(500).json({ error: "Failed to create charge" });     
  } 
};  

export const handleWebHook = async (req: Request, res: Response) => {     
  const sig = req.headers["stripe-signature"] as string;      
  let event: Stripe.Event;       
  
  try {         
    event = stripe.webhooks.constructEvent(             
      req.body,             
      sig,             
      process.env.STRIPE_WEBHOOK_SECRET!         
    );      
  } catch (err: any) {         
    console.error("Webhook signature verification failed:", err.message);         
    res.status(400).send(`Webhook Error: ${err.message}`);         
    return;       
  }       
  
  if (event.type === "checkout.session.completed") {         
    const session = event.data.object as Stripe.Checkout.Session;         
    const userId = session.client_reference_id;          
    
    if (userId) {             
      try {
        const user = await User.findByIdAndUpdate(
          userId,                 
          { isPremium: true },                 
          { new: true }             
        );              
        
        if (user && user.email) {
          // Use displayName directly - it's guaranteed to exist based on your model
          await sendPremiumConfirmationEmail(user.email, user.displayName);
          console.log(`Premium confirmation email sent to ${user.email}`);
        } else {
          console.error("User or email not found:", user);
        }
      } catch (error) {
        console.error("Error updating user premium status:", error);
      }
    }      
  }       
  
  res.json({ received: true }); 
};  

export const getPremiumStatus = async (req: Request, res: Response) => {     
  const user = req.user as IUser;     
  
  if (user.isPremium) {         
    res.json({ status: "active" });     
  } else {         
    res.json({ status: "inactive" });     
  } 
};