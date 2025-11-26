  · How do you want to handle the
     database storage issue? → Add 
    PostgreSQL database

────────────────────────────────────────
 Ready to code?

 Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 Deploy Keka Chatbot to Railway (Single
  Service + PostgreSQL)

 Overview

 Deploy both backend and frontend as a
 single Railway service, with
 PostgreSQL for handoff storage. This
 provides the simplest deployment with
 one domain and automatic HTTPS.

 ---
 PART 1: Database Migration 
 (PostgreSQL)

 Problem

 Current backend/data/handoffs.json
 uses file storage, which is ephemeral
 on Railway (data lost on restart).

 Solution

 Migrate to PostgreSQL database with a
 handoffs table.

 Changes Required:

 1.1: Install PostgreSQL Package

 - Add pg to backend dependencies
 - Update backend/package.json

 1.2: Create Database Schema

 - Create backend/src/db/schema.sql
 with handoffs table
 - Columns: id, service_type,
 contact_name, contact_type,
 contact_value, form_data (JSON),
 timestamp

 1.3: Update Handoff Service

 - Replace
 fs.readFileSync/writeFileSync with
 PostgreSQL queries
 - File:
 backend/src/services/handoff.ts
 - Add connection pool using Railway's
 DATABASE_URL env var

 1.4: Add Database Init Script

 - Create backend/src/db/init.ts to
 create table on first run
 - Auto-run on server startup if table
 doesn't exist

 ---
 PART 2: Backend Serves Frontend

 Changes Required

 2.1: Add Static File Serving

 File: backend/src/server.ts

 Add after API routes:
 import path from 'path';

 // Serve static files from frontend 
 build
 app.use(express.static(path.join(__dir
 name, 'public')));

 // Catch-all route for SPA
 app.get('*', (req, res) => {
   res.sendFile(path.join(__dirname,
 'public/index.html'));
 });

 2.2: Update Build Process

 File: backend/package.json

 Add scripts:
 {
   "scripts": {
     "build": "tsc && npm run 
 build:frontend",
     "build:frontend": "cd ../frontend 
 && npm run build && cp -r dist 
 ../backend/dist/public"
   }
 }

 2.3: Update CORS Configuration

 File: backend/src/server.ts

 Allow same-origin requests (frontend
 served from same domain):
 app.use(cors({
   origin: true, // Allow same origin
   credentials: true
 }));

 ---
 PART 3: Railway Configuration

 3.1: Create Railway Config

 File: railway.json (root directory)

 {
   "$schema": "https://railway.app/rail
 way.schema.json",
   "build": {
     "builder": "NIXPACKS",
     "buildCommand": "npm install && 
 npm run build -w backend && cd backend
  && npm run build:frontend"
   },
   "deploy": {
     "startCommand": "npm start -w 
 backend",
     "restartPolicyType": "ON_FAILURE",
     "restartPolicyMaxRetries": 10
   }
 }

 3.2: Update Frontend API URL

 File: frontend/.env.production (create
  new)

 VITE_API_URL=  # Empty = same origin 
 (backend serves frontend)

 File: frontend/src/api.ts

 Update to use relative URLs when
 deployed:
 const API_BASE_URL =
 import.meta.env.VITE_API_URL || '';

 ---
 PART 4: Environment Variables for 
 Railway

 Set these in Railway dashboard:

 Required

 NODE_ENV=production
 PORT=auto-assigned-by-railway
 DATABASE_URL=auto-set-by-postgresql-pl
 ugin
 LOG_LEVEL=warn
 HASH_SALT=<generate-32-char-random-str
 ing>

 Optional (Email/SMS)

 AWS_REGION=us-east-1
 AWS_ACCESS_KEY_ID=<your-key>
 AWS_SECRET_ACCESS_KEY=<your-secret>
 SES_FROM_EMAIL=noreply@kekarehabservic
 es.com
 HANDOFF_EMAIL=admin@kekarehabservices.
 com
 HANDOFF_PHONE=+1234567890

 ---
 PART 5: WordPress Embedding Options

 Once deployed to Railway (e.g.,
 https://keka-chatbot.railway.app), you
  have 3 embedding options:

 Option A: iframe Embed (Easiest)

 <!-- WordPress HTML Block -->
 <iframe 
   
 src="https://keka-chatbot.railway.app"
  
   style="position: fixed; bottom: 
 20px; right: 20px; width: 400px; 
 height: 600px; border: none; z-index: 
 9999; border-radius: 16px; box-shadow:
  0 10px 40px rgba(0,0,0,0.2);"
   title="Keka Support Chat">
 </iframe>

 Pros: Simple, no conflicts, easy to
 update
 Cons: Fixed size, cross-origin
 limitations

 Option B: Popup Window

 <!-- WordPress HTML Block -->
 <button onclick="window.open('https://
 keka-chatbot.railway.app', 'chat', 
 'width=400,height=600')">
   Chat with Keka
 </button>

 Pros: Full functionality, no embedding
  issues
 Cons: Popup blockers, separate window

 Option C: WordPress Plugin with AJAX

 Create a plugin that loads the chatbot
  UI locally and makes API calls to
 Railway backend.

 Pros: Native integration, no iframe
 Cons: Requires plugin development,
 complex

 ---
 DEPLOYMENT STEPS SUMMARY

 1. Add PostgreSQL to Railway Project
   - Railway Dashboard → New → Database
  → PostgreSQL
   - Copy DATABASE_URL environment
 variable
 2. Migrate Database Code
   - Install pg package
   - Update handoff.ts to use
 PostgreSQL
   - Create database init script
 3. Configure Backend Static Serving
   - Add Express static middleware
   - Add SPA catch-all route
   - Update build scripts
 4. Create Railway Config
   - Add railway.json to root
   - Set build and start commands
 5. Deploy to Railway
   - Connect GitHub repository
   - Configure environment variables
   - Deploy from main branch
 6. Embed in WordPress
   - Use iframe method for quick start
   - Or develop plugin for production

 ---
 ESTIMATED COSTS

 - Railway Hobby Plan: $5/month
 - PostgreSQL Database: $5/month
 - Estimated Usage: $5-10/month
 - Total: ~$15-20/month

 ---
 FILES TO MODIFY

 - ✏️ backend/package.json - Add
 build:frontend script, pg dependency
 - ✏️ backend/src/server.ts - Add
 static file serving
 - ✏️ backend/src/services/handoff.ts -
  Replace file storage with PostgreSQL
 - ✏️ frontend/.env.production - Empty
 API URL (same origin)
 - ✏️ frontend/src/api.ts - Support
 relative URLs
 - ➕ railway.json - Railway
 configuration
 - ➕ backend/src/db/init.ts - Database
  initialization
 - ➕ backend/src/db/schema.sql -
 Database schema

 ---
 NEXT STEPS AFTER DEPLOYMENT

 1. Test chatbot at Railway URL
 2. Verify database stores handoffs
 3. Test email notifications
 4. Embed in WordPress test page
 5. Configure custom domain (optional)
 6. Set up monitoring/alerts