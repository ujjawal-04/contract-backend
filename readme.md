# Contract Analysis Web Application

This application is a Next.js-based platform that provides AI-powered contract analysis. It enables users to upload contract documents in PDF format, process them through AI analysis, and receive detailed reports highlighting risks, opportunities, and key clauses.

## 🌟 Features

### Core Functionality
- **Intelligent Risk Detection** - Identifies potential risks with severity ratings
- **Opportunity Discovery** - Highlights beneficial clauses and opportunities
- **Contract Type Detection** - Automatically identifies contract types
- **Interactive Dashboard** - Comprehensive analytics and contract management

### Premium Features
- **Unlimited Contract Analysis** - No restrictions on uploads
- **Advanced Risk Analysis** - 10+ detailed risk assessments
- **Comprehensive Opportunities** - 10+ opportunity identifications
- **Detailed Recommendations** - Expert suggestions for contract improvements
- **Legal Compliance Assessment** - Thorough compliance analysis
- **Negotiation Points** - Strategic negotiation recommendations
- **Financial Terms Breakdown** - Detailed compensation analysis
- **Performance Metrics** - KPI identification and tracking

### User Experience
- **Google OAuth Authentication** - Secure single sign-on
- **Tiered Subscription Model** - Free and Premium tiers via Stripe
- **Responsive Design** - Optimized for desktop and mobile
- **Real-time Processing** - Fast contract analysis with caching
- **User Account Management** - Profile and subscription management

## 🛠️ Technology Stack

### Backend
- **Node.js** with Express.js framework
- **TypeScript** for type safety
- **MongoDB** with Mongoose ODM
- **Redis** (Upstash) for caching and session storage
- **Google Generative AI** (Gemini) for contract analysis
- **Passport.js** for Google OAuth authentication
- **Stripe API** for payment processing
- **Nodemailer** for email notifications


### Infrastructure
- **MongoDB Atlas** for database hosting
- **Upstash Redis** for caching
- **Railway/Vercel** for deployment
- **Stripe Dashboard** for payment management



### Installation

1. **Clone the repository**
   ```bash
   git clone github-project-path
   cd github-project
   ```

2. **Install backend dependencies**
   ```bash
   yarn install
   ```


4. **Environment Setup**

   Create `.env` file in the root directory:
   ```env
    MONGODB_URI=your_mongodb_connection_string
    GOOGLE_CLIENT_ID=
    GOOGLE_CLIENT_SECRET=
    GOOGLE_CALLBACK_URL=http://localhost:8080/auth/google/callback
    CLIENT_URL=http://localhost:3000
    SESSION_SECRET=secret
    NODE_ENV=development
    UPSTASH_REDIS_REST_URL=
    UPSTASH_REDIS_REST_TOKEN=
    GEMINI_API_KEY=
    RESEND_API_KEY=
    STRIPE_SECRET_KEY=
    STRIPE_WEBHOOK_SECRET=
   ```

5. **Start the application**
   ```bash
   # Start backend server
   yarn dev
   
   ```



## 📁 Project Structure

```
contract-analysis/
├── src/                          # Backend source code
│   ├── app.ts                   # Express application setup
│   ├── config/                  # Configuration files
│   │   ├── db.ts               # Database connection
│   │   ├── passport.ts         # Passport OAuth config
│   │   ├── redis.ts            # Redis configuration
│   │   └── ssl.ts              # SSL configuration
│   ├── controllers/            # Request handlers
│   │   ├── contract.controller.ts
│   │   ├── payment.controller.ts
│   │   └── user.controller.ts
│   ├── middleware/             # Custom middleware
│   │   ├── auth.ts             # Authentication middleware
│   │   └── errors.ts           # Error handling
│   ├── models/                 # Mongoose schemas
│   │   ├── contract.model.ts   # Contract analysis schema
│   │   └── user.model.ts       # User schema
│   ├── routes/                 # Express routes
│   │   ├── auth.ts             # Authentication routes
│   │   ├── contracts.ts        # Contract management routes
│   │   ├── payments.ts         # Payment processing routes
│   │   └── user.routes.ts      # User management routes
│   ├── services/               # Business logic
│   │   ├── ai.services.ts      # AI contract analysis
│   │   └── email.service.ts    # Email notifications
│   └── utils/                  # Utility functions
│       └── mongoUtils.ts       # MongoDB utilities
└── README.md                   # Project documentation
```

## API Keys Configuration

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project:
   - Project name: `contract`
   - Organization: Select "No organization"
   - Click "Create"
3. Navigate to "API & Services" in the quick access menu
4. Click on "Credentials" in the sidebar
5. Click "Create Credentials" at the top and select "OAuth client ID"
6. Select "Configure Consent Screen"
7. Choose "External" as the user type and click "Create"
8. Fill in the application details:
   - App name: `contract-analysis`
   - User support email: Select your email
   - Developer contact information: Add your email
9. Click "Save and Continue" for the remaining steps
10. Click "Add or Remove Scopes" if needed, then "Save and Continue"
11. Click "Add Users" if needed for testing, then "Save and Continue"
12. Review the summary and click "Back to Dashboard"
13. Now, return to the Credentials page and click "Create Credentials" > "OAuth client ID"
14. Select "Web application" as the application type
15. Name: `contract`
16. Add the following authorized origins and redirects:
    - Authorized JavaScript origins: `http://localhost:3000`
    - Authorized redirect URIs: `http://localhost:8080/auth/google/callback`
17. Click "Create"
18. Copy the "Client ID" and "Client Secret" and add them to your server's `.env` file

### Gemini API Setup

1. Visit [Google AI Studio](https://aistudio.google.com)
2. Sign in with your Google account
3. Click on "Get API Key"
4. Click "Create API Key"
5. Select your project (the one named "contract")
6. Click "Create"
7. Copy the generated API key and add it to your server's `.env` file

### Redis Setup (Upstash)

1. Visit [Upstash](https://upstash.com/)
2. Sign up or log in
3. Click "Create Database"
4. Configure your database:
   - Name: `contract`
   - Select a primary region (any works)
   - Click "Next"
   - Select the free plan
   - Click "Next" and "Create"
5. From the REST API section, copy:
   - UPSTASH_REDIS_REST_URL
   - UPSTASH_REDIS_REST_TOKEN
6. Add these values to your server's `.env` file

### Email Setup (Nodemailer)

1. Install Nodemailer
bashnpm install nodemailer
2. Enable Gmail App Password
Google requires App Passwords for SMTP authentication instead of your regular Gmail password.
Steps to create Gmail App Password:

Go to Google Account Security
Enable 2-Step Verification (if not already enabled)
After enabling 2FA, return to the Security page
Under "Signing in to Google", click App passwords
Click Select app → choose Mail
Click Select device → choose Other (Custom name) → type Contract Analysis App
Click Generate
Copy the 16-character App Password (format: abcd efgh ijkl mnop)

3. Configure Environment Variables
Add the following Gmail SMTP configuration to your .env file:
envEMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password-here
Configuration Details:

EMAIL_HOST: smtp.gmail.com (Gmail SMTP server)
EMAIL_PORT: 587 (TLS) or 465 (SSL)
EMAIL_SECURE: false for port 587, true for port 465
EMAIL_USER: Your complete Gmail address
EMAIL_PASS: The 16-character App Password (not your Gmail password)

Note: The App Password should be entered without spaces (e.g., abcdefghijklmnop)

### Stripe Payment Integration

1. Visit [Stripe](https://stripe.com/in)
2. Sign up or log in
3. Go to "Developers" > "API Keys"
4. Copy the Secret key and add it to your server's `.env` file
5. Copy the Publishable key and add it to your client's `.env` file

#### Setting up Stripe Webhooks for Local Development

1. In the Stripe dashboard, go to "Developers" > "Webhooks"
2. Click "Test with a local listener"
3. Click "Download Stripe CLI"
4. Select Windows and download `stripe_1.26.1_windows_x86_64.zip`
5. Unzip the file
6. Create a folder called "StripeCLI" in Program Files
7. Move the Stripe application to this folder
8. Add the folder path to your system's PATH environment variable:
   - Right-click on "This PC" or "My Computer" and select "Properties"
   - Click on "Advanced system settings"
   - Click on "Environment Variables"
   - Under "System variables", find and select the "Path" variable
   - Click "Edit"
   - Click "New" and add the path to your StripeCLI folder
   - Click "OK" on all dialogs
9. Open a command prompt and run:
   ```bash
   stripe login
   ```
10. Follow the link provided and authorize the CLI
11. Once authorized, run:
    ```bash
    stripe listen --forward-to localhost:8080/payments/webhook
    ```
12. Copy the webhook signing secret that's displayed and add it to your server's `.env` file as `STRIPE_WEBHOOK_SECRET`



## 📊 API Endpoints

### Authentication
- `GET /auth/google` - Initiate Google OAuth
- `GET /auth/google/callback` - OAuth callback
- `GET /auth/current-user` - Get current user
- `GET /auth/logout` - Logout user

### Contracts
- `GET /contracts/user-stats` - Get user contract statistics
- `POST /contracts/detect-type` - Detect contract type
- `POST /contracts/analyze` - Analyze contract
- `GET /contracts/user-contracts` - Get user's contracts
- `GET /contracts/contract/:id` - Get specific contract
- `DELETE /contracts/:id` - Delete contract

### Payments
- `GET /payments/create-checkout-session` - Create Stripe session
- `GET /payments/membership-status` - Get premium status
- `POST /payments/webhook` - Stripe webhook handler

### Users
- `DELETE /api/users/delete-account` - Delete user account

## 💼 Business Logic

### Free Plan Limitations
- **2 contract analyses** maximum
- **Basic risk detection** (5+ risks)
- **Limited opportunities** (5+ opportunities)
- **Basic summary** only

### Premium Plan Benefits
- **Unlimited contract analyses**
- **Advanced risk detection** (10+ detailed risks)
- **Comprehensive opportunities** (10+ opportunities)
- **Detailed recommendations**
- **Legal compliance assessment**
- **Negotiation points**
- **Financial terms breakdown**
- **Performance metrics**
- **Lifetime access**

