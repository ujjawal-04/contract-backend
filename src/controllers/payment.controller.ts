import { Request, Response } from "express";
import User, { IUser } from "../models/user.model";
import Stripe from "stripe";
import { sendPremiumConfirmationEmail } from "../services/email.service";

// Stripe init
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-07-30.basil"
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
    return res.status(400).json({ error: "Invalid plan selected" });
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
    
    if (userId) {
      try {
        // Update user plan only (no isPremium anymore)
        const user = await User.findByIdAndUpdate(
          userId,
          { plan: planType },
          { new: true }
        );
        
        if (user && user.email) {
          try {
            await sendPremiumConfirmationEmail(user.email, user.displayName, planType);
            console.log(`${planType} confirmation email sent to ${user.email}`);
          } catch (emailError) {
            console.error("Failed to send confirmation email:", emailError);
          }
        } else {
          console.error("User or email not found:", user);
        }
      } catch (error) {
        console.error("Error updating user subscription:", error);
      }
    }
  }
  
  // Always respond 200 to Stripe
  res.json({ received: true });
};

export const getPremiumStatus = async (req: Request, res: Response) => {
  const user = req.user as IUser;

  if (user.plan === "premium") {
    res.json({ status: "active", plan: "premium" });
  } else if (user.plan === "gold") {
    res.json({ status: "active", plan: "gold" });
  } else {
    res.json({ status: "inactive", plan: "basic" });
  }
};
