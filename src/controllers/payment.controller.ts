import { Request, Response } from "express";
import User, { IUser } from "../models/user.model";
import Stripe from "stripe";
import { sendPremiumConfirmationEmail } from "../services/email.service";

// Stripe init
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-03-31.basil"
});

// Plan configurations
const PLANS = {
  premium: {
    name: "Premium Subscription",
    amount: 2000, // $20.00
  },
  gold: {
    name: "Gold Subscription",
    amount: 5000, // $50.00
  }
};

export const createCheckoutSession = async (req: Request, res: Response) => {
  const user = req.user as IUser & { _id: { toString(): string } };
  const { plan } = req.query;
  
  // Validate plan
  if (!plan || !["premium", "gold"].includes(plan as string)) {
   res.status(400).json({ error: "Invalid plan selected" });
  }
  
  const planType = plan as keyof typeof PLANS;
  const selectedPlan = PLANS[planType];
  
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: selectedPlan.name,
              description: `Lifetime access to Lexalyze ${planType.charAt(0).toUpperCase() + planType.slice(1)}`,
            },
            unit_amount: selectedPlan.amount,
          },
          quantity: 1,
        },
      ],
      customer_email: user.email,
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/payment-success?plan=${planType}`,
      cancel_url: `${process.env.CLIENT_URL}/payment-cancel`,
      client_reference_id: user._id.toString(),
      metadata: {
        planType: planType,
        userId: user._id.toString()
      }
    });
    
    console.log(`Created checkout session for user ${user._id} for ${planType} plan`);
    res.json({ sessionId: session.id });
  } catch (error) {
    console.error("Checkout session creation error:", error);
    res.status(500).json({ error: "Failed to create checkout session" });
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
    const planType = session.metadata?.planType || "premium";
    
    console.log(`Processing webhook for user ${userId}, plan: ${planType}`);
    
    if (userId) {
      try {
        // Update user plan in database
        const user = await User.findByIdAndUpdate(
          userId,
          { plan: planType },
          { new: true }
        );
        
        if (user) {
          console.log(`Successfully updated user ${userId} to ${planType} plan`);
          
          // Send confirmation email
          if (user.email) {
            try {
              await sendPremiumConfirmationEmail(user.email, user.displayName, planType);
              console.log(`${planType} confirmation email sent to ${user.email}`);
            } catch (emailError) {
              console.error("Failed to send confirmation email:", emailError);
            }
          }
        } else {
          console.error("User not found after update:", userId);
        }
      } catch (error) {
        console.error("Error updating user subscription:", error);
      }
    } else {
      console.error("No user ID found in webhook session");
    }
  }
  
  // Always respond 200 to Stripe
  res.json({ received: true });
};

export const getPremiumStatus = async (req: Request, res: Response) => {
  const user = req.user as Express.User;

  try {
    // Fetch fresh user data from database to ensure we have the latest plan info
    const dbUser = await User.findById(user._id);
    
    if (!dbUser) {
     res.status(404).json({ error: "User not found" });
    }

    const userPlan = dbUser?.plan || "basic";
    
    console.log(`Getting membership status for user ${user._id}: ${userPlan}`);
    
    // Return consistent response format
    const response = {
      status: userPlan !== "basic" ? "active" : "inactive",
      plan: userPlan,
      isPremium: userPlan === "premium" || userPlan === "gold",
      isGold: userPlan === "gold",
      hasGoldAccess: userPlan === "gold"
    };
    
    res.json(response);
  } catch (error) {
    console.error("Error getting premium status:", error);
    res.status(500).json({ error: "Failed to get membership status" });
  }
};