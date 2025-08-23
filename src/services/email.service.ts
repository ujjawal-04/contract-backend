// email.service.ts
import nodemailer from "nodemailer";

// Create a transporter using environment variables
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export const sendPremiumConfirmationEmail = async (
  userEmail: string, 
  userName: string, 
  planType: string = "premium"
) => {
  try {
    // Define plan-specific content
    const planConfigs = {
      premium: {
        name: "Premium",
        color: "#1a56db",
        emoji: "⭐",
        features: [
          "Unlimited contract analysis with advanced insights",
          "Detailed contract breakdown with 10+ risk identifications",
          "10+ opportunity detections with impact analysis",
          "Key clause identification and analysis",
          "Negotiation point suggestions for stronger positioning",
          "Comprehensive legal compliance assessment",
          "Priority email support",
          "Lifetime access to all premium features"
        ],
        specialNote: "Premium Access Activated",
        description: "advanced legal intelligence tools"
      },
      gold: {
        name: "Gold",
        color: "#f59e0b",
        emoji: "👑",
        features: [
          "Everything in Premium, plus:",
          "AI-powered contract chat for instant guidance",
          "Smart contract modification with track changes",
          "Enhanced analysis with 15+ risk identifications",
          "15+ opportunity detections with detailed impact levels",
          "Custom recommendation generation tailored to your needs",
          "Download modified contract versions with change tracking",
          "Compliance-focused contract editing suggestions",
          "24/7 premium support with priority response",
          "Access to cutting-edge AI contract intelligence"
        ],
        specialNote: "Gold Elite Access Activated",
        description: "our most advanced AI-powered contract intelligence suite"
      }
    };

    const config = planConfigs[planType as keyof typeof planConfigs] || planConfigs.premium;

    const info = await transporter.sendMail({
      from: '"Lexalyze Team" <team@lexalyze.com>',
      to: userEmail,
      subject: `🎉 Welcome to Lexalyze ${config.name} - Your ${config.name} subscription is now active!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${config.name} Subscription Activated</title>
          <style>
            body {
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background-color: #f5f7fa;
              color: #333333;
              line-height: 1.6;
            }
            .container {
              max-width: 640px;
              margin: 24px auto;
              background-color: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
            }
            .header {
              padding: 40px 30px;
              text-align: center;
              background: linear-gradient(135deg, ${config.color}, ${config.color}dd);
              color: white;
            }
            .header h1 {
              color: #ffffff;
              font-size: 28px;
              margin: 0;
              font-weight: 700;
            }
            .header .subtitle {
              font-size: 16px;
              margin: 10px 0 0 0;
              opacity: 0.9;
            }
            .content {
              padding: 40px 30px;
            }
            .welcome-message {
              font-size: 16px;
              margin-bottom: 25px;
              color: #374151;
            }
            .plan-badge {
              display: inline-block;
              background: ${config.color};
              color: white;
              padding: 8px 20px;
              border-radius: 20px;
              font-size: 14px;
              font-weight: 600;
              margin: 15px 0;
            }
            .features-section {
              background: linear-gradient(135deg, #f8fafc, #f1f5f9);
              border-radius: 12px;
              padding: 30px;
              margin: 30px 0;
              border-left: 4px solid ${config.color};
            }
            .features-title {
              color: #1f2937;
              font-size: 20px;
              margin: 0 0 20px 0;
              font-weight: 600;
              display: flex;
              align-items: center;
            }
            .features-list {
              list-style: none;
              padding: 0;
              margin: 0;
            }
            .features-list li {
              padding: 10px 0;
              color: #4b5563;
              border-bottom: 1px solid #e5e7eb;
              position: relative;
              padding-left: 30px;
              font-size: 15px;
            }
            .features-list li:last-child {
              border-bottom: none;
            }
            .features-list li:before {
              content: "✓";
              position: absolute;
              left: 0;
              color: ${config.color};
              font-weight: bold;
              font-size: 16px;
            }
            ${planType === 'gold' ? `
              .gold-highlight {
                background: linear-gradient(135deg, #fef3c7, #fbbf24);
                border: 2px solid #f59e0b;
                border-radius: 10px;
                padding: 20px;
                margin: 25px 0;
                text-align: center;
              }
              .gold-highlight h3 {
                color: #92400e;
                margin: 0 0 10px 0;
                font-size: 18px;
                font-weight: 700;
              }
              .gold-highlight p {
                color: #92400e;
                margin: 0;
                font-size: 15px;
              }
            ` : ''}
            .cta-section {
              text-align: center;
              margin: 35px 0;
            }
            .cta-button {
              display: inline-block;
              background: linear-gradient(135deg, ${config.color}, ${config.color}dd);
              color: #ffffff;
              font-weight: 700;
              padding: 16px 32px;
              text-decoration: none;
              border-radius: 8px;
              font-size: 16px;
              transition: transform 0.2s, box-shadow 0.2s;
              box-shadow: 0 4px 12px ${config.color}40;
            }
            .cta-button:hover {
              transform: translateY(-2px);
              box-shadow: 0 8px 20px ${config.color}50;
            }
            .support-section {
              background: #f0f9ff;
              border: 1px solid #0ea5e9;
              border-radius: 8px;
              padding: 20px;
              margin: 25px 0;
            }
            .support-section h4 {
              color: #0c4a6e;
              margin: 0 0 10px 0;
              font-size: 16px;
              font-weight: 600;
            }
            .support-section p {
              color: #0c4a6e;
              margin: 0;
              font-size: 14px;
            }
            .footer {
              background: #f9fafb;
              padding: 30px;
              text-align: center;
              color: #6b7280;
              font-size: 13px;
              border-top: 1px solid #e5e7eb;
            }
            .footer a {
              color: ${config.color};
              text-decoration: none;
            }
            .stats {
              display: flex;
              justify-content: space-around;
              margin: 25px 0;
              text-align: center;
            }
            .stat {
              flex: 1;
              padding: 10px;
            }
            .stat-number {
              font-size: 24px;
              font-weight: 700;
              color: ${config.color};
            }
            .stat-label {
              font-size: 12px;
              color: #6b7280;
              text-transform: uppercase;
              margin-top: 5px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${config.emoji} ${config.specialNote}</h1>
              <p class="subtitle">Welcome to Lexalyze ${config.name}</p>
            </div>

            <div class="content">
              <div class="welcome-message">
                <p><strong>Dear ${userName},</strong></p>
                <p>Congratulations and welcome to <strong>Lexalyze ${config.name}</strong>! ${config.emoji}</p>
                <p>Your lifetime subscription has been successfully activated, and you now have full access to ${config.description}.</p>
                <div class="plan-badge">${config.name} Member</div>
              </div>

              ${planType === 'gold' ? `
                <div class="gold-highlight">
                  <h3>🚀 You've unlocked our most powerful AI features!</h3>
                  <p>As a Gold member, you have exclusive access to AI chat and contract modification tools that will transform how you work with contracts.</p>
                </div>
              ` : ''}

              <div class="stats">
                <div class="stat">
                  <div class="stat-number">${planType === 'gold' ? '15+' : '10+'}</div>
                  <div class="stat-label">Risk Identifications</div>
                </div>
                <div class="stat">
                  <div class="stat-number">${planType === 'gold' ? '15+' : '10+'}</div>
                  <div class="stat-label">Opportunities</div>
                </div>
                <div class="stat">
                  <div class="stat-number">∞</div>
                  <div class="stat-label">Analyses</div>
                </div>
              </div>

              <div class="features-section">
                <h3 class="features-title">
                  ${config.emoji} Your ${config.name} Features:
                </h3>
                <ul class="features-list">
                  ${config.features.map(feature => `<li>${feature}</li>`).join('')}
                </ul>
              </div>

              <div class="support-section">
                <h4>🎯 Ready to get started?</h4>
                <p>All your ${config.name} features are now active and ready to use. Head to your dashboard to begin analyzing contracts with our enhanced AI capabilities.</p>
              </div>

              <div class="cta-section">
                <a href="${process.env.CLIENT_URL}/dashboard" class="cta-button">
                  🚀 Start Analyzing Contracts
                </a>
              </div>

              ${planType === 'gold' ? `
                <div style="background: linear-gradient(135deg, #fef3c7, #fef3c7); border-radius: 8px; padding: 20px; margin: 25px 0; border-left: 4px solid #f59e0b;">
                  <h4 style="color: #92400e; margin: 0 0 15px 0;">🤖 Exclusive Gold Features Guide:</h4>
                  <ul style="color: #92400e; margin: 0; padding-left: 20px;">
                    <li><strong>AI Chat:</strong> Ask questions about any contract and get instant, context-aware responses</li>
                    <li><strong>Smart Modifications:</strong> Request contract changes and see AI-powered edits with track changes</li>
                    <li><strong>Custom Recommendations:</strong> Get personalized suggestions based on your specific needs</li>
                    <li><strong>24/7 Support:</strong> Priority access to our expert support team</li>
                  </ul>
                </div>
              ` : ''}

              <p style="font-size: 15px; line-height: 1.6; margin-top: 25px;">
                Need help getting started? Our ${planType === 'gold' ? '24/7 premium support team' : 'priority support team'} is here to assist you. Simply reach out to us at 
                <a href="mailto:support@lexalyze.com" style="color: ${config.color}; text-decoration: none; font-weight: 600;">support@lexalyze.com</a>.
              </p>

              <p style="font-size: 15px; margin-top: 30px; color: #374151;">
                Thank you for choosing Lexalyze. We're excited to help you unlock the full potential of your contracts!
              </p>
              
              <p style="font-size: 15px; margin-bottom: 0; color: #374151;">
                <strong>Best regards,</strong><br>
                The Lexalyze Team ${config.emoji}
              </p>
            </div>

            <div class="footer">
              <p style="margin: 0 0 8px 0;"><strong>© 2025 Lexalyze. All rights reserved.</strong></p>
              <p style="margin: 0;">
                <a href="mailto:team@lexalyze.com">team@lexalyze.com</a> | 
                <a href="#" style="color: ${config.color};">Privacy Policy</a> | 
                <a href="#" style="color: ${config.color};">Terms of Service</a>
              </p>
              <p style="margin: 8px 0 0 0; font-size: 12px; color: #9ca3af;">
                This email was sent to ${userEmail}. You're receiving this because you upgraded to ${config.name}.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      // Plain text version for email clients that don't support HTML
      text: `
        🎉 Welcome to Lexalyze ${config.name}!

        Dear ${userName},

        Congratulations! Your ${config.name} subscription has been successfully activated.

        Your ${config.name} Features:
        ${config.features.map(feature => `• ${feature}`).join('\n')}

        ${planType === 'gold' ? `
        🚀 Gold Exclusive Features:
        • AI-powered contract chat for instant guidance
        • Smart contract modification with change tracking
        • Custom recommendations tailored to your needs
        • 24/7 premium support with priority response
        ` : ''}

        Ready to get started? Visit your dashboard: ${process.env.CLIENT_URL}/dashboard

        Need help? Contact us at support@lexalyze.com

        Thank you for choosing Lexalyze!

        Best regards,
        The Lexalyze Team ${config.emoji}
      `
    });

    console.log(`${config.name} confirmation email sent successfully:`, info.messageId);
    return info;
  } catch (error) {
    console.error(`Error sending ${planType} confirmation email:`, error);
    throw error;
  }
};

// Send welcome email for new basic users
export const sendWelcomeEmail = async (userEmail: string, userName: string) => {
  try {
    const info = await transporter.sendMail({
      from: '"Lexalyze Team" <team@lexalyze.com>',
      to: userEmail,
      subject: '🎉 Welcome to Lexalyze - Start analyzing contracts today!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Lexalyze</title>
          <style>
            body {
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background-color: #f5f7fa;
              color: #333333;
              line-height: 1.6;
            }
            .container {
              max-width: 600px;
              margin: 24px auto;
              background-color: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
            }
            .header {
              padding: 40px 30px;
              text-align: center;
              background: linear-gradient(135deg, #3B82F6, #2563EB);
              color: white;
            }
            .content {
              padding: 40px 30px;
            }
            .cta-button {
              display: inline-block;
              background: linear-gradient(135deg, #3B82F6, #2563EB);
              color: #ffffff;
              font-weight: 700;
              padding: 16px 32px;
              text-decoration: none;
              border-radius: 8px;
              font-size: 16px;
              box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
            }
            .features {
              background: #f8fafc;
              border-radius: 8px;
              padding: 25px;
              margin: 25px 0;
            }
            .upgrade-prompt {
              background: linear-gradient(135deg, #fef3c7, #fbbf24);
              border-radius: 8px;
              padding: 20px;
              margin: 25px 0;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome to Lexalyze!</h1>
              <p>Your AI-powered contract analysis journey starts here</p>
            </div>

            <div class="content">
              <p><strong>Hi ${userName},</strong></p>
              <p>Welcome to Lexalyze! We're excited to help you analyze contracts with the power of AI.</p>

              <div class="features">
                <h3>🆓 Your Free Account Includes:</h3>
                <ul>
                  <li>✅ 2 contract analyses</li>
                  <li>✅ 5 risk identifications per contract</li>
                  <li>✅ 5 opportunity detections per contract</li>
                  <li>✅ Basic contract summaries</li>
                  <li>✅ Key clause identification</li>
                  <li>✅ Email support</li>
                </ul>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.CLIENT_URL}/dashboard" class="cta-button">
                  🚀 Analyze Your First Contract
                </a>
              </div>

              <div class="upgrade-prompt">
                <h3 style="color: #92400e; margin: 0 0 10px 0;">🚀 Want More?</h3>
                <p style="color: #92400e; margin: 0 0 15px 0;">
                  Upgrade to Premium or Gold for unlimited analyses, enhanced AI insights, and exclusive features!
                </p>
                <a href="${process.env.CLIENT_URL}/pricing" style="color: #92400e; font-weight: 600; text-decoration: none;">
                  View Premium Plans →
                </a>
              </div>

              <p>Questions? We're here to help at <a href="mailto:support@lexalyze.com" style="color: #3B82F6;">support@lexalyze.com</a></p>

              <p><strong>Best regards,</strong><br>The Lexalyze Team</p>
            </div>

            <div style="background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 13px;">
              <p style="margin: 0;">© 2025 Lexalyze. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Welcome to Lexalyze!

        Hi ${userName},

        Welcome to Lexalyze! We're excited to help you analyze contracts with AI.

        Your Free Account Includes:
        • 2 contract analyses
        • 5 risk identifications per contract
        • 5 opportunity detections per contract
        • Basic contract summaries
        • Key clause identification

        Get started: ${process.env.CLIENT_URL}/dashboard
        
        Want more features? Check out our Premium and Gold plans: ${process.env.CLIENT_URL}/pricing

        Questions? Contact us: support@lexalyze.com

        Best regards,
        The Lexalyze Team
      `
    });

    console.log("Welcome email sent successfully:", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending welcome email:", error);
    throw error;
  }
};

// Send plan upgrade notification (when user upgrades from one paid plan to another)
export const sendPlanUpgradeEmail = async (
  userEmail: string, 
  userName: string, 
  fromPlan: string, 
  toPlan: string
) => {
  try {
    const info = await transporter.sendMail({
      from: '"Lexalyze Team" <team@lexalyze.com>',
      to: userEmail,
      subject: `🎉 Plan Upgraded! Welcome to Lexalyze ${toPlan}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 30px; text-align: center; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Plan Upgraded Successfully!</h1>
            </div>
            <div style="padding: 30px;">
              <p>Hi ${userName},</p>
              <p>Great news! You've successfully upgraded from ${fromPlan} to <strong>${toPlan}</strong>.</p>
              <p>Your new features are now active and ready to use!</p>
              <div style="text-align: center; margin: 25px 0;">
                <a href="${process.env.CLIENT_URL}/dashboard" style="background: #f59e0b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                  Explore Your New Features
                </a>
              </div>
              <p>Thank you for your continued trust in Lexalyze!</p>
            </div>
          </div>
        </body>
        </html>
      `
    });

    console.log("Plan upgrade email sent successfully:", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending plan upgrade email:", error);
    throw error;
  }
};

// Verify the email configuration on startup
export const verifyEmailConnection = async () => {
  try {
    await transporter.verify();
    console.log("Email server connection verified");
    return true;
  } catch (error) {
    console.error("Email server connection failed:", error);
    return false;
  }
};