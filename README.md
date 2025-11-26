# Keka Rehab Services - HIPAA-Safe Support Chatbot

A full-stack, HIPAA-compliant chatbot for patient, family, and community support.

## 🩺 Features

- **Modern UI/UX**: Beautiful chat widget with animations, avatars, and timestamps
- **Click-First UX**: Button-driven conversational flow
- **HIPAA Compliance**: No PHI collection, strict validation, secure logging
- **Intake Flow**: Email/phone validation and contact capture
- **8 Top-Level Menu Options**: Start Intake, Therapy & Rehab, Home Care, Staffing, Insurance, Equipment, Community, Speak with a Human
- **Knowledge Base**: FAQ + RAG from public website content
- **Wait for Human**: Direct contact capture for care requests
- **Security**: CORS, Helmet, rate limiting, URL allow-list
- **Accessibility**: WCAG 2.1 AA compliant (ARIA, keyboard nav, focus trap)


## 🛡️ HIPAA Compliance

- **Minimum Necessary**: Never solicits or stores PHI
- **Data Collected**: Only phone/email, topic, and non-PHI context
- **URL Allow-list**: Only renders approved Keka domain links
- **Secure Logging**: No raw user input, only event types and hashed IPs
- **PHI Detection**: 15+ keywords trigger safe refusal and contact flow

## 🏗️ Architecture

```
/
├── backend/                    # Node/Express + TypeScript API
│   ├── src/
│   │   ├── routes/             # API endpoints (chat, handoff, events)
│   │   ├── services/           # Business logic (FAQ, RAG, handoff)
│   │   ├── types/              # Zod schemas & PHI detection
│   │   ├── utils/              # Logger (privacy-preserving)
│   │   └── server.ts           # Express app with security middleware
│   └── data/                   # docs.index.json for RAG
├── frontend/                   # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/
│   │   │   ├── chat/           # Chat UI components (10+ components)
│   │   │   ├── intake/         # Contact capture form
│   │   │   └── ui/             # Reusable UI elements
│   │   ├── hooks/              # useChat, useFocusTrap
│   │   ├── utils/              # Validation utilities
│   │   └── api.ts              # Backend API client
├── scripts/                    # Utility scripts
│   └── crawl-keka.ts           # Website content crawler
└── shared/                     # Shared types (optional)
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm 9+

### Installation

```bash
# Install all dependencies (monorepo)
npm install
```

### Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Configure:

```bash
# Backend
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
LOG_LEVEL=info

# Frontend
VITE_API_URL=http://localhost:3001
```

### Generate Document Index (Optional but Recommended)

```bash
npm run crawl
```

This creates `backend/data/docs.index.json` with stub website content for retrieval testing.

### Development

```bash
# Start both frontend (port 5173) and backend (port 3001)
npm run dev
```

Visit http://localhost:5173 and click the chat button in the bottom-right corner!

### Verify Setup

- Backend health: http://localhost:3001/api/health
- Frontend: http://localhost:5173
- Chat widget should appear in bottom-right corner with smooth animations

## 📊 Top-Level Menu

1. ✅ **Start Intake / Request Care** - Direct to contact capture
2. 🏥 **Therapy & Rehabilitation**
3. 🩺 **Home Care & Caregiver Services**
4. 👩‍⚕️ **Staffing & Agency Support**
5. 💳 **Insurance & Billing Questions**
6. 🛠️ **Home Safety & Equipment Help**
7. 🏘️ **Community Programs & Marketplace**

## ✅ Acceptance Tests

- ✅ All responses pass schema validation
- ✅ PHI guard rejects sensitive inputs
- ✅ All links are allow-listed
- ✅ Logs contain no raw user input
- ✅ Home screen shows 7 top-level buttons
- ✅ "Start Intake" leads to contact capture
- ✅ All service flows include resolution check
- ✅ Contact capture validates and transitions to complete

## 📝 License

Proprietary - Keka Rehab Services
