# Keka Rehab Services - HIPAA-Safe Support Chatbot
## High-Level Architecture Overview

### Project Overview
A HIPAA-compliant, full-stack conversational support system designed for patient, family, and community interactions with Keka Rehab Services. The system uses a button-driven UX to guide users through service inquiries, intake flows, and contact capture while strictly avoiding Protected Health Information (PHI) collection.

---

## Technology Stack

### Backend (`backend/src/server.ts`)
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js 4.x
- **Security**: Helmet (CSP), CORS, rate limiting (100 req/15min)
- **Validation**: Zod schemas for type-safe request/response handling
- **Development**: tsx for hot-reload TypeScript execution

### Frontend (`frontend/package.json`)
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 4.x (fast dev server and optimized production builds)
- **UI Pattern**: Single ChatWidget component with session-based state management
- **API Client**: Fetch-based REST client (`frontend/src/api.ts`)

### Monorepo Setup (`package.json`)
- npm workspaces managing backend and frontend as separate packages
- Concurrently runs both dev servers for local development
- Shared TypeScript types across workspaces

---

## Architecture Pattern

### Layered Backend Architecture

```
backend/src/
├── server.ts          # Express app configuration, middleware, routes
├── routes/            # HTTP endpoint handlers
│   ├── chat.ts        # POST /api/chat - main conversation endpoint
│   └── handoff.ts     # POST /api/handoff/request - contact capture
├── services/          # Business logic layer
│   ├── chat.ts        # State machine orchestration
│   ├── faq.ts         # Knowledge base (7 categories, 30+ FAQs)
│   ├── retrieve.ts    # RAG/embedding-based search (stub for future)
│   └── handoff.ts     # Contact validation and persistence
├── types/             # Zod schemas and TypeScript types
│   └── schema.ts      # PHI detection, validation, allowed domains
└── utils/
    └── logger.ts      # Privacy-preserving logging (hashed IPs, no PII)
```

### Component-Based Frontend

```
frontend/src/
├── App.tsx            # Root component
├── components/
│   └── ChatWidget.tsx # Stateful chat interface (6025 lines of business logic)
├── api.ts             # Backend API client
└── types.ts           # Shared TypeScript interfaces
```

---

## Core Architectural Patterns

### 1. State Machine Conversation Flow (`backend/src/services/chat.ts:39`)

The chatbot operates as a finite state machine with 5 states:

- **`awaiting_user_choice`**: Home menu or service category navigation
- **`awaiting_contact`**: Collecting contact type (email/phone) and value
- **`awaiting_care_for`**: Determining care recipient (self/loved one)
- **`awaiting_setting`**: Selecting care environment (in-home/clinic/day health)
- **`complete`**: End state after successful intake

State transitions are driven by user button clicks and validated input, ensuring a predictable and auditable conversation flow.

### 2. Multi-Strategy Knowledge Base

#### Structured FAQ System (`backend/src/services/faq.ts`)
- 7 top-level categories with curated Q&A pairs
- Each answer includes relevant links to kekarehabservices.com
- Resolution checks after each answer ("Did this help?")

#### RAG Retrieval (Planned) (`backend/src/services/retrieve.ts`)
- Embedding-based semantic search using crawled website content
- Currently stubbed for future Azure OpenAI or AWS Bedrock integration
- Fallback to keyword-based search
- Vector similarity using cosine distance

#### Button-Driven Navigation
Pre-defined paths reduce free-text ambiguity and minimize PHI risk.

### 3. Security-First Design

#### PHI Protection (`backend/src/types/schema.ts:55`)
- Input scanning for 15+ PHI keywords (SSN, diagnosis, medications, etc.)
- Immediate rejection with user-friendly warning message
- Zero storage of medical information

```typescript
PHI_KEYWORDS = [
  'ssn', 'social security', 'dob', 'date of birth',
  'diagnosis', 'medication', 'prescription', 'surgery',
  'blood pressure', 'test result', 'insurance id', ...
]
```

#### Transport Security (`backend/src/server.ts:17`)
- **Helmet.js** with strict Content Security Policy
- **HSTS** with 1-year max-age and preload
- **CORS** locked to specific frontend origins
- **JSON body limit** of 200kb

#### Rate Limiting (`backend/src/server.ts:51`)
- 100 requests per IP per 15-minute window
- Standardized rate limit headers
- Protects against abuse and DoS

#### Privacy-Preserving Logging (`backend/src/utils/logger.ts:58`)
- IP addresses hashed with SHA-256 + salt
- No raw user input logged (only event types and metadata)
- Structured JSON logs for compliance auditing

#### URL Allowlist (`backend/src/types/schema.ts:78`)
- Only `kekarehabservices.com` links rendered
- Prevents phishing/XSS via malicious links

---

## Data Flow

### Conversational Flow

```
User -> ChatWidget (React)
  -> POST /api/chat {message, session_id, session_data}
  -> PHI validation (reject if detected)
  -> State machine routing (chat.ts)
  -> FAQ/retrieval service lookup
  -> Response {text, buttons, links, next_state, session_data}
  -> ChatWidget renders buttons and updates session state
```

### Contact Capture Flow

```
User clicks "Start Intake"
  -> State: awaiting_contact (email/phone selection)
  -> State: awaiting_contact (value input)
  -> Validation (handoff.ts:54 - email regex or phone regex)
  -> State: awaiting_care_for (self/loved one)
  -> State: awaiting_setting (in-home/clinic/day health)
  -> POST /api/handoff/request
  -> Save to data/handoffs.json (fs-based, production would use DB/CRM)
  -> State: complete (success message with contact info)
```

### Session Management
- Client-side session ID generation (`crypto.randomUUID` or fallback)
- Session data persisted in React state across conversation turns
- No server-side session storage (stateless API design)

---

## Key Features

### 7-Category Service Menu (`backend/src/services/faq.ts:18`)

1. **Start Intake / Request Care** - Direct to contact capture
2. **Therapy & Rehabilitation** - PT, OT, speech therapy
3. **Home Care & Staffing** - Caregivers, nurses, disability support
4. **Business & Agency Support** - B2B services, contracting
5. **Access, Insurance & Billing** - Payment options, insurance questions
6. **Equipment & Home Safety** - DME, home modifications
7. **Community & E-Commerce** - Marketplace, programs

### Contextual Help Flows

Each service category provides:
- Sub-questions with detailed answers
- Relevant links to kekarehabservices.com pages
- Resolution check ("Did this help?" with fallback to human handoff)

### Graceful Human Handoff

- "I need more help" button available after FAQ answers
- Validated contact capture (email/phone regex validation)
- Context preservation (session data passed through entire flow)
- Handoff records saved with timestamp and session metadata

---

## Deployment & Infrastructure

### Development

```bash
npm run dev  # Runs backend (port 3001) + frontend (port 5173) concurrently
```

### Production Build

```bash
npm run build  # Compiles TypeScript backend + Vite frontend bundle
npm start      # Runs compiled backend (serves backend only; frontend deployed separately)
```

### Environment Configuration (`.env.example`)

**Backend:**
- `PORT` - Server port (default: 3001)
- `FRONTEND_URL` - CORS origin for frontend
- `LOG_LEVEL` - Logging verbosity (info, warn, error, debug)
- `HASH_SALT` - Salt for IP hashing

**Frontend:**
- `VITE_API_URL` - Backend API endpoint

**Future:**
- Azure OpenAI or AWS Bedrock credentials for embeddings

### Data Persistence (`backend/src/services/handoff.ts:28`)

**Current:**
- JSON files in `data/` directory (development-friendly)

**Production:**
- Replace with HIPAA-compliant database (AWS RDS with encryption, Azure SQL, etc.)
- Add CRM integration (Salesforce, HubSpot, etc.)

---

## Compliance & Testing

### HIPAA Compliance Measures

- **Minimum Necessary Principle**: Only collects contact info and non-PHI context
- **No PHI Storage**: Explicit keyword detection and rejection
- **Secure Logging**: Hashed IPs, event-based logging (no raw input)
- **Audit Trail**: Structured JSON logs for compliance reviews
- **Transport Security**: HTTPS enforced, HSTS headers
- **Access Controls**: Rate limiting, CORS restrictions

### Acceptance Criteria (`README.md:76`)

- ✅ All responses pass Zod schema validation
- ✅ PHI guard rejects sensitive inputs
- ✅ All links are allowlisted
- ✅ Logs contain no raw user input
- ✅ Home screen shows 7 top-level buttons
- ✅ "Start Intake" leads to contact capture
- ✅ All service flows include resolution check
- ✅ Contact capture validates and transitions correctly

---

## Future Enhancements

### 1. RAG Integration (`backend/src/services/retrieve.ts:34`)
- Replace stub embeddings with Azure OpenAI `text-embedding-ada-002`
- Semantic search over crawled website content
- Hybrid retrieval (embeddings + keyword fallback)
- Vector database integration (Pinecone, Weaviate, etc.)

### 2. Database Integration (`backend/src/services/handoff.ts:28`)
- Move from JSON files to production database
- Add CRM integration (Salesforce, HubSpot, etc.)
- Implement data retention policies
- Add encryption at rest

### 3. Analytics & Monitoring
- Structured logs ready for log aggregation (CloudWatch, DataDog, etc.)
- Session metrics (resolution rates, handoff triggers, category usage)
- A/B testing framework for conversation flows
- Real-time alerting on errors and anomalies

### 4. Advanced NLU
- Intent classification for free-text fallback
- Entity extraction for structured data capture
- Multi-language support
- Sentiment analysis for escalation triggers

---

## Design Principles

1. **Security First**: Every feature designed with HIPAA compliance in mind
2. **Fail Safely**: Default to human handoff when uncertain
3. **Transparency**: Clear messaging about data usage and privacy
4. **Accessibility**: Button-driven interface reduces barriers
5. **Auditability**: Every interaction logged for compliance review
6. **Stateless API**: Horizontal scalability without session stores
7. **Progressive Enhancement**: Graceful degradation for RAG when unavailable

---

## File Reference Guide

### Critical Files

| File | Purpose | Lines |
|------|---------|-------|
| `backend/src/server.ts` | Express app, middleware, security | 100 |
| `backend/src/services/chat.ts` | State machine orchestration | 242 |
| `backend/src/services/faq.ts` | Knowledge base content | 600+ |
| `backend/src/types/schema.ts` | Validation, PHI detection | 98 |
| `backend/src/utils/logger.ts` | Privacy-preserving logging | 80 |
| `frontend/src/components/ChatWidget.tsx` | Main UI component | 6025 |
| `frontend/src/api.ts` | Backend API client | ~100 |

### Configuration Files

- `package.json` - Monorepo workspace configuration
- `.env.example` - Environment variable template
- `backend/tsconfig.json` - TypeScript configuration
- `frontend/vite.config.ts` - Vite build configuration

---

This architecture prioritizes **security, compliance, and user experience** through strict input validation, stateless API design, and a guided conversational interface that minimizes risk while maximizing accessibility.
