// src/services/email.service.ts - UPDATED VERSION WITHOUT AI FUNCTIONS
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

// Keep existing functions...
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
            /* Reset and base styles */
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              background-color: #f5f7fa;
              color: #333333;
              line-height: 1.6;
              -webkit-text-size-adjust: 100%;
              -ms-text-size-adjust: 100%;
            }
            
            table {
              border-collapse: collapse;
              mso-table-lspace: 0pt;
              mso-table-rspace: 0pt;
            }
            
            img {
              border: 0;
              height: auto;
              line-height: 100%;
              outline: none;
              text-decoration: none;
              -ms-interpolation-mode: bicubic;
            }
            
            /* Main container */
            .email-container {
              width: 100%;
              max-width: 640px;
              margin: 0 auto;
              background-color: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
            }
            
            .wrapper {
              width: 100%;
              table-layout: fixed;
              background-color: #f5f7fa;
              padding: 20px 0;
            }
            
            /* Header */
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
              line-height: 1.2;
            }
            
            .header .subtitle {
              font-size: 16px;
              margin: 10px 0 0 0;
              opacity: 0.9;
              line-height: 1.4;
            }
            
            /* Content */
            .content {
              padding: 40px 30px;
            }
            
            .welcome-message {
              font-size: 16px;
              margin-bottom: 25px;
              color: #374151;
              line-height: 1.6;
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
            
            /* Features section */
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
              line-height: 1.3;
            }
            
            .features-list {
              list-style: none;
              padding: 0;
              margin: 0;
            }
            
            .features-list li {
              padding: 12px 0;
              color: #4b5563;
              border-bottom: 1px solid #e5e7eb;
              position: relative;
              padding-left: 30px;
              font-size: 15px;
              line-height: 1.5;
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
            
            /* Gold highlights */
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
                line-height: 1.3;
              }
              .gold-highlight p {
                color: #92400e;
                margin: 0;
                font-size: 15px;
                line-height: 1.5;
              }
              
              .gold-features-guide {
                background: linear-gradient(135deg, #fef3c7, #fef3c7);
                border-radius: 8px;
                padding: 20px;
                margin: 25px 0;
                border-left: 4px solid #f59e0b;
              }
              
              .gold-features-guide h4 {
                color: #92400e;
                margin: 0 0 15px 0;
                font-size: 16px;
                font-weight: 600;
                line-height: 1.3;
              }
              
              .gold-features-guide ul {
                color: #92400e;
                margin: 0;
                padding-left: 20px;
                line-height: 1.6;
              }
            ` : ''}
            
            /* Stats */
            .stats {
              display: table;
              width: 100%;
              margin: 25px 0;
              table-layout: fixed;
            }
            
            .stat {
              display: table-cell;
              text-align: center;
              padding: 10px 5px;
              vertical-align: top;
            }
            
            .stat-number {
              font-size: 24px;
              font-weight: 700;
              color: ${config.color};
              line-height: 1.2;
            }
            
            .stat-label {
              font-size: 12px;
              color: #6b7280;
              text-transform: uppercase;
              margin-top: 5px;
              line-height: 1.3;
            }
            
            /* CTA Button */
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
              line-height: 1.4;
            }
            
            /* Support section */
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
              line-height: 1.3;
            }
            
            .support-section p {
              color: #0c4a6e;
              margin: 0;
              font-size: 14px;
              line-height: 1.5;
            }
            
            /* Footer */
            .footer {
              background: #f9fafb;
              padding: 30px;
              text-align: center;
              color: #6b7280;
              font-size: 13px;
              border-top: 1px solid #e5e7eb;
              line-height: 1.5;
            }
            
            .footer a {
              color: ${config.color};
              text-decoration: none;
            }
            
            /* Mobile responsiveness */
            @media only screen and (max-width: 640px) {
              .wrapper {
                padding: 10px 0;
              }
              
              .email-container {
                margin: 0 10px;
                border-radius: 8px;
              }
              
              .header {
                padding: 30px 20px;
              }
              
              .header h1 {
                font-size: 24px;
                line-height: 1.2;
              }
              
              .header .subtitle {
                font-size: 15px;
                margin-top: 8px;
              }
              
              .content {
                padding: 30px 20px;
              }
              
              .features-section {
                padding: 20px;
                margin: 20px 0;
                border-radius: 8px;
              }
              
              .features-title {
                font-size: 18px;
                line-height: 1.3;
                margin-bottom: 15px;
              }
              
              .features-list li {
                padding: 10px 0;
                font-size: 14px;
                padding-left: 25px;
                line-height: 1.5;
              }
              
              .gold-highlight,
              .gold-features-guide {
                padding: 15px;
                margin: 20px 0;
                border-radius: 8px;
              }
              
              .gold-highlight h3 {
                font-size: 16px;
              }
              
              .gold-highlight p {
                font-size: 14px;
              }
              
              .stats {
                margin: 20px 0;
              }
              
              .stat {
                padding: 8px 3px;
              }
              
              .stat-number {
                font-size: 20px;
              }
              
              .stat-label {
                font-size: 11px;
              }
              
              .cta-button {
                padding: 14px 24px;
                font-size: 15px;
                display: block;
                margin: 0 auto;
                max-width: 280px;
              }
              
              .support-section {
                padding: 15px;
                margin: 20px 0;
              }
              
              .footer {
                padding: 20px 15px;
                font-size: 12px;
              }
              
              .welcome-message {
                font-size: 15px;
                margin-bottom: 20px;
              }
              
              .plan-badge {
                font-size: 13px;
                padding: 6px 16px;
              }
            }
            
            @media only screen and (max-width: 480px) {
              .header h1 {
                font-size: 22px;
              }
              
              .header .subtitle {
                font-size: 14px;
              }
              
              .content {
                padding: 25px 15px;
              }
              
              .features-section {
                padding: 15px;
              }
              
              .features-title {
                font-size: 16px;
              }
              
              .features-list li {
                font-size: 13px;
                padding: 8px 0;
                padding-left: 20px;
              }
              
              .stat-number {
                font-size: 18px;
              }
              
              .cta-button {
                padding: 12px 20px;
                font-size: 14px;
              }
              
              .footer {
                padding: 15px 10px;
              }
            }
            
            /* Dark mode support */
            @media (prefers-color-scheme: dark) {
              .email-container {
                background-color: #1f2937;
                color: #f9fafb;
              }
              
              .welcome-message {
                color: #d1d5db;
              }
              
              .features-section {
                background: linear-gradient(135deg, #374151, #4b5563);
                color: #f9fafb;
              }
              
              .features-title {
                color: #f9fafb;
              }
              
              .features-list li {
                color: #d1d5db;
                border-bottom-color: #4b5563;
              }
              
              .support-section {
                background: #1e40af;
                border-color: #3b82f6;
              }
              
              .footer {
                background: #111827;
                color: #9ca3af;
                border-top-color: #374151;
              }
            }
          </style>
        </head>
        <body>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="wrapper">
            <tr>
              <td>
                <div class="email-container">
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
                      <div class="gold-features-guide">
                        <h4>🤖 Exclusive Gold Features Guide:</h4>
                        <ul>
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
              </td>
            </tr>
          </table>
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

// NEW: Date alert email function
export const sendDateAlertEmail = async (
    userEmail: string,
    userName: string,
    contractId: string,
    contractType: string,
    dateInfo: {
        dateType: string;
        date: Date;
        description: string;
        clause: string;
        daysUntil: number;
    }
) => {
    try {
        const urgencyConfig = getUrgencyConfig(dateInfo.daysUntil);
        const dateTypeDisplay = formatDateType(dateInfo.dateType);

        const info = await transporter.sendMail({
            from: '"Lexalyze Alerts" <alerts@lexalyze.com>',
            to: userEmail,
            subject: `🔔 ${urgencyConfig.emoji} Contract Alert: ${dateTypeDisplay} in ${dateInfo.daysUntil} day${dateInfo.daysUntil !== 1 ? 's' : ''}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Contract Date Alert</title>
                    <style>
                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                        }
                        
                        body {
                            margin: 0;
                            padding: 0;
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                            background-color: #f5f7fa;
                            color: #333333;
                            line-height: 1.6;
                        }
                        
                        .email-container {
                            width: 100%;
                            max-width: 600px;
                            margin: 0 auto;
                            background-color: #ffffff;
                            border-radius: 12px;
                            overflow: hidden;
                            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
                        }
                        
                        .wrapper {
                            width: 100%;
                            background-color: #f5f7fa;
                            padding: 20px 0;
                        }
                        
                        .header {
                            padding: 30px;
                            text-align: center;
                            background: linear-gradient(135deg, ${urgencyConfig.color}, ${urgencyConfig.color}dd);
                            color: white;
                        }
                        
                        .header h1 {
                            color: #ffffff;
                            font-size: 24px;
                            margin: 0 0 10px 0;
                            font-weight: 700;
                        }
                        
                        .header p {
                            font-size: 16px;
                            margin: 0;
                            opacity: 0.9;
                        }
                        
                        .content {
                            padding: 30px;
                        }
                        
                        .alert-box {
                            background: ${urgencyConfig.bgColor};
                            border-left: 5px solid ${urgencyConfig.color};
                            border-radius: 8px;
                            padding: 20px;
                            margin: 20px 0;
                        }
                        
                        .alert-box h3 {
                            color: ${urgencyConfig.textColor};
                            margin: 0 0 15px 0;
                            font-size: 18px;
                            font-weight: 600;
                        }
                        
                        .date-info {
                            background: #f8fafc;
                            border-radius: 8px;
                            padding: 20px;
                            margin: 20px 0;
                        }
                        
                        .date-row {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            padding: 8px 0;
                            border-bottom: 1px solid #e5e7eb;
                        }
                        
                        .date-row:last-child {
                            border-bottom: none;
                        }
                        
                        .date-label {
                            font-weight: 600;
                            color: #374151;
                        }
                        
                        .date-value {
                            color: #6b7280;
                        }
                        
                        .clause-box {
                            background: #f0f9ff;
                            border: 1px solid #0ea5e9;
                            border-radius: 8px;
                            padding: 15px;
                            margin: 20px 0;
                        }
                        
                        .clause-box h4 {
                            color: #0c4a6e;
                            margin: 0 0 10px 0;
                            font-size: 14px;
                            font-weight: 600;
                        }
                        
                        .clause-box p {
                            color: #0c4a6e;
                            margin: 0;
                            font-size: 13px;
                            font-style: italic;
                        }
                        
                        .cta-button {
                            display: inline-block;
                            background: ${urgencyConfig.color};
                            color: #ffffff;
                            font-weight: 700;
                            padding: 14px 28px;
                            text-decoration: none;
                            border-radius: 8px;
                            font-size: 15px;
                        }
                        
                        .cta-section {
                            text-align: center;
                            margin: 25px 0;
                        }
                        
                        .footer {
                            background: #f9fafb;
                            padding: 20px;
                            text-align: center;
                            color: #6b7280;
                            font-size: 13px;
                        }
                        
                        @media only screen and (max-width: 600px) {
                            .wrapper {
                                padding: 10px 0;
                            }
                            
                            .email-container {
                                margin: 0 10px;
                            }
                            
                            .header {
                                padding: 25px 20px;
                            }
                            
                            .content {
                                padding: 25px 20px;
                            }
                            
                            .date-row {
                                flex-direction: column;
                                align-items: flex-start;
                            }
                            
                            .date-value {
                                margin-top: 5px;
                            }
                        }
                    </style>
                </head>
                <body>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="wrapper">
                        <tr>
                            <td>
                                <div class="email-container">
                                    <div class="header">
                                        <h1>${urgencyConfig.emoji} Contract Date Alert</h1>
                                        <p>Important date approaching for your ${contractType}</p>
                                    </div>

                                    <div class="content">
                                        <p><strong>Hi ${userName},</strong></p>
                                        <p>This is a friendly reminder about an important date in your contract:</p>

                                        <div class="alert-box">
                                            <h3>${urgencyConfig.title}</h3>
                                            <p>${dateInfo.description} is scheduled for <strong>${formatDate(dateInfo.date)}</strong> - that's in ${dateInfo.daysUntil} day${dateInfo.daysUntil !== 1 ? 's' : ''}!</p>
                                        </div>

                                        <div class="date-info">
                                            <div class="date-row">
                                                <span class="date-label">Date Type:</span>
                                                <span class="date-value">${dateTypeDisplay}</span>
                                            </div>
                                            <div class="date-row">
                                                <span class="date-label">Due Date:</span>
                                                <span class="date-value">${formatDate(dateInfo.date)}</span>
                                            </div>
                                            <div class="date-row">
                                                <span class="date-label">Days Remaining:</span>
                                                <span class="date-value" style="color: ${urgencyConfig.color}; font-weight: 600;">${dateInfo.daysUntil}</span>
                                            </div>
                                            <div class="date-row">
                                                <span class="date-label">Contract Type:</span>
                                                <span class="date-value">${contractType}</span>
                                            </div>
                                        </div>

                                        <div class="clause-box">
                                            <h4>📄 Related Contract Clause:</h4>
                                            <p>"${dateInfo.clause}"</p>
                                        </div>

                                        <div class="cta-section">
                                            <a href="${process.env.CLIENT_URL}/contracts/${contractId}" class="cta-button">
                                                View Contract Details
                                            </a>
                                        </div>

                                        <p style="font-size: 14px; color: #6b7280; margin-top: 25px;">
                                            ${urgencyConfig.actionText}
                                        </p>

                                        <p style="margin-top: 20px;">
                                            <strong>Best regards,</strong><br>
                                            Your Lexalyze Alert System
                                        </p>
                                    </div>

                                    <div class="footer">
                                        <p>© 2025 Lexalyze. All rights reserved.</p>
                                        <p style="margin-top: 8px; font-size: 12px;">
                                            To manage your alert preferences, <a href="${process.env.CLIENT_URL}/contracts/${contractId}?tab=alerts" style="color: #3b82f6;">click here</a>
                                        </p>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
            `,
            text: `
                Contract Date Alert

                Hi ${userName},

                This is a reminder about an important date in your ${contractType} contract:

                ${dateInfo.description} is scheduled for ${formatDate(dateInfo.date)} - that's in ${dateInfo.daysUntil} day${dateInfo.daysUntil !== 1 ? 's' : ''}!

                Date Type: ${dateTypeDisplay}
                Due Date: ${formatDate(dateInfo.date)}
                Days Remaining: ${dateInfo.daysUntil}

                Related Clause: "${dateInfo.clause}"

                View Contract: ${process.env.CLIENT_URL}/contracts/${contractId}

                ${urgencyConfig.actionText}

                Best regards,
                Your Lexalyze Alert System
            `
        });

        console.log(`Date alert email sent successfully to ${userEmail}:`, info.messageId);
        return info;
    } catch (error) {
        console.error("Error sending date alert email:", error);
        throw error;
    }
};

// Helper functions for email formatting
const getUrgencyConfig = (daysUntil: number) => {
    if (daysUntil <= 1) {
        return {
            emoji: '🚨',
            color: '#dc2626',
            bgColor: '#fee2e2',
            textColor: '#991b1b',
            title: 'URGENT: Date is Tomorrow or Today!',
            actionText: 'This date is very soon - please take immediate action if required.'
        };
    } else if (daysUntil <= 3) {
        return {
            emoji: '⚠️',
            color: '#f59e0b',
            bgColor: '#fef3c7',
            textColor: '#92400e',
            title: 'Important Date Approaching Soon',
            actionText: 'Please prepare for any actions needed regarding this date.'
        };
    } else if (daysUntil <= 7) {
        return {
            emoji: '📅',
            color: '#3b82f6',
            bgColor: '#dbeafe',
            textColor: '#1d4ed8',
            title: 'Upcoming Contract Date',
            actionText: 'You have some time to prepare, but please plan accordingly.'
        };
    } else {
        return {
            emoji: '🔔',
            color: '#10b981',
            bgColor: '#d1fae5',
            textColor: '#065f46',
            title: 'Contract Date Reminder',
            actionText: 'This is an early reminder to help you stay organized.'
        };
    }
};

const formatDateType = (dateType: string): string => {
    const typeMap: { [key: string]: string } = {
        'start_date': 'Contract Start',
        'end_date': 'Contract End',
        'renewal_date': 'Renewal Date',
        'termination_notice': 'Termination Notice',
        'payment_due': 'Payment Due',
        'review_date': 'Review Date',
        'warranty_expiry': 'Warranty Expiry',
        'other': 'Important Date'
    };
    return typeMap[dateType] || 'Contract Date';
};

const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

// Keep existing functions unchanged...
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
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              background-color: #f5f7fa;
              color: #333333;
              line-height: 1.6;
              -webkit-text-size-adjust: 100%;
              -ms-text-size-adjust: 100%;
            }
            
            table {
              border-collapse: collapse;
              mso-table-lspace: 0pt;
              mso-table-rspace: 0pt;
            }
            
            .email-container {
              width: 100%;
              max-width: 600px;
              margin: 0 auto;
              background-color: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
            }
            
            .wrapper {
              width: 100%;
              table-layout: fixed;
              background-color: #f5f7fa;
              padding: 20px 0;
            }
            
            .header {
              padding: 40px 30px;
              text-align: center;
              background: linear-gradient(135deg, #3B82F6, #2563EB);
              color: white;
            }
            
            .header h1 {
              color: #ffffff;
              font-size: 28px;
              margin: 0 0 10px 0;
              font-weight: 700;
              line-height: 1.2;
            }
            
            .header p {
              font-size: 16px;
              margin: 0;
              opacity: 0.9;
              line-height: 1.4;
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
              line-height: 1.4;
            }
            
            .features {
              background: #f8fafc;
              border-radius: 8px;
              padding: 25px;
              margin: 25px 0;
              border-left: 4px solid #3B82F6;
            }
            
            .features h3 {
              color: #1f2937;
              font-size: 18px;
              margin: 0 0 15px 0;
              font-weight: 600;
              line-height: 1.3;
            }
            
            .features ul {
              list-style: none;
              padding: 0;
              margin: 0;
            }
            
            .features li {
              padding: 8px 0;
              color: #4b5563;
              font-size: 15px;
              line-height: 1.5;
            }
            
            .upgrade-prompt {
              background: linear-gradient(135deg, #fef3c7, #fbbf24);
              border-radius: 8px;
              padding: 20px;
              margin: 25px 0;
              text-align: center;
            }
            
            .upgrade-prompt h3 {
              color: #92400e;
              margin: 0 0 10px 0;
              font-size: 18px;
              font-weight: 700;
              line-height: 1.3;
            }
            
            .upgrade-prompt p {
              color: #92400e;
              margin: 0 0 15px 0;
              font-size: 15px;
              line-height: 1.5;
            }
            
            .upgrade-prompt a {
              color: #92400e;
              font-weight: 600;
              text-decoration: none;
            }
            
            .footer {
              background: #f9fafb;
              padding: 20px;
              text-align: center;
              color: #6b7280;
              font-size: 13px;
              line-height: 1.5;
            }
            
            /* Mobile responsiveness */
            @media only screen and (max-width: 600px) {
              .wrapper {
                padding: 10px 0;
              }
              
              .email-container {
                margin: 0 10px;
                border-radius: 8px;
              }
              
              .header {
                padding: 30px 20px;
              }
              
              .header h1 {
                font-size: 24px;
              }
              
              .header p {
                font-size: 15px;
              }
              
              .content {
                padding: 30px 20px;
              }
              
              .features {
                padding: 20px;
                margin: 20px 0;
              }
              
              .features h3 {
                font-size: 16px;
              }
              
              .features li {
                font-size: 14px;
                padding: 6px 0;
              }
              
              .upgrade-prompt {
                padding: 15px;
                margin: 20px 0;
              }
              
              .upgrade-prompt h3 {
                font-size: 16px;
              }
              
              .upgrade-prompt p {
                font-size: 14px;
              }
              
              .cta-button {
                padding: 14px 24px;
                font-size: 15px;
                display: block;
                margin: 0 auto;
                max-width: 280px;
              }
              
              .footer {
                padding: 15px 10px;
                font-size: 12px;
              }
            }
            
            @media only screen and (max-width: 480px) {
              .header h1 {
                font-size: 22px;
              }
              
              .header p {
                font-size: 14px;
              }
              
              .content {
                padding: 25px 15px;
              }
              
              .features {
                padding: 15px;
              }
              
              .cta-button {
                padding: 12px 20px;
                font-size: 14px;
              }
            }
          </style>
        </head>
        <body>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="wrapper">
            <tr>
              <td>
                <div class="email-container">
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
                      <h3>🚀 Want More?</h3>
                      <p>
                        Upgrade to Premium or Gold for unlimited analyses, enhanced AI insights, and exclusive features!
                      </p>
                      <a href="${process.env.CLIENT_URL}/pricing">
                        View Premium Plans →
                      </a>
                    </div>

                    <p>Questions? We're here to help at <a href="mailto:support@lexalyze.com" style="color: #3B82F6;">support@lexalyze.com</a></p>

                    <p><strong>Best regards,</strong><br>The Lexalyze Team</p>
                  </div>

                  <div class="footer">
                    <p style="margin: 0;">© 2025 Lexalyze. All rights reserved.</p>
                  </div>
                </div>
              </td>
            </tr>
          </table>
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
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Plan Upgraded Successfully</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              background-color: #f5f7fa;
              color: #333333;
              line-height: 1.6;
              -webkit-text-size-adjust: 100%;
              -ms-text-size-adjust: 100%;
            }
            
            table {
              border-collapse: collapse;
              mso-table-lspace: 0pt;
              mso-table-rspace: 0pt;
            }
            
            .email-container {
              width: 100%;
              max-width: 600px;
              margin: 0 auto;
              background-color: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
            }
            
            .wrapper {
              width: 100%;
              table-layout: fixed;
              background-color: #f5f7fa;
              padding: 20px 0;
            }
            
            .header {
              background: linear-gradient(135deg, #f59e0b, #d97706);
              color: white;
              padding: 40px 30px;
              text-align: center;
              border-radius: 0;
            }
            
            .header h1 {
              color: #ffffff;
              font-size: 28px;
              margin: 0;
              font-weight: 700;
              line-height: 1.2;
            }
            
            .content {
              padding: 40px 30px;
            }
            
            .content p {
              font-size: 16px;
              line-height: 1.6;
              margin: 0 0 15px 0;
              color: #374151;
            }
            
            .cta-button {
              display: inline-block;
              background: #f59e0b;
              color: white;
              padding: 16px 32px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 700;
              font-size: 16px;
              line-height: 1.4;
              box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
            }
            
            .cta-section {
              text-align: center;
              margin: 30px 0;
            }
            
            .footer {
              background: #f9fafb;
              padding: 20px 30px;
              text-align: center;
              color: #6b7280;
              font-size: 13px;
              line-height: 1.5;
            }
            
            /* Mobile responsiveness */
            @media only screen and (max-width: 600px) {
              .wrapper {
                padding: 10px 0;
              }
              
              .email-container {
                margin: 0 10px;
                border-radius: 8px;
              }
              
              .header {
                padding: 30px 20px;
              }
              
              .header h1 {
                font-size: 24px;
              }
              
              .content {
                padding: 30px 20px;
              }
              
              .content p {
                font-size: 15px;
              }
              
              .cta-button {
                padding: 14px 24px;
                font-size: 15px;
                display: block;
                margin: 0 auto;
                max-width: 280px;
              }
              
              .footer {
                padding: 15px 10px;
                font-size: 12px;
              }
            }
            
            @media only screen and (max-width: 480px) {
              .header h1 {
                font-size: 22px;
              }
              
              .content {
                padding: 25px 15px;
              }
              
              .content p {
                font-size: 14px;
              }
              
              .cta-button {
                padding: 12px 20px;
                font-size: 14px;
              }
            }
          </style>
        </head>
        <body>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="wrapper">
            <tr>
              <td>
                <div class="email-container">
                  <div class="header">
                    <h1>🎉 Plan Upgraded Successfully!</h1>
                  </div>
                  
                  <div class="content">
                    <p><strong>Hi ${userName},</strong></p>
                    <p>Great news! You've successfully upgraded from <strong>${fromPlan}</strong> to <strong>${toPlan}</strong>.</p>
                    <p>Your new features are now active and ready to use!</p>
                    
                    <div class="cta-section">
                      <a href="${process.env.CLIENT_URL}/dashboard" class="cta-button">
                        Explore Your New Features
                      </a>
                    </div>
                    
                    <p>Thank you for your continued trust in Lexalyze!</p>
                    
                    <p style="margin-top: 30px;"><strong>Best regards,</strong><br>The Lexalyze Team</p>
                  </div>
                  
                  <div class="footer">
                    <p style="margin: 0;">© 2025 Lexalyze. All rights reserved.</p>
                  </div>
                </div>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
      text: `
        🎉 Plan Upgraded Successfully!

        Hi ${userName},

        Great news! You've successfully upgraded from ${fromPlan} to ${toPlan}.

        Your new features are now active and ready to use!

        Explore your new features: ${process.env.CLIENT_URL}/dashboard

        Thank you for your continued trust in Lexalyze!

        Best regards,
        The Lexalyze Team
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
