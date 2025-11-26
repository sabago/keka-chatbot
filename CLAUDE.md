# Developer Guide
## Everything You Need to Work on the Keka Chatbot

This guide contains everything you need to effectively develop, debug, and deploy the Keka HIPAA-compliant chatbot.

---

## Table of Contents
1. [Prerequisites & Environment Setup](#prerequisites--environment-setup)
2. [First-Time Setup](#first-time-setup)
3. [Understanding the Codebase](#understanding-the-codebase)
4. [Development Workflow](#development-workflow)
5. [Code Conventions](#code-conventions)
6. [Critical Knowledge: HIPAA & Security](#critical-knowledge-hipaa--security)
7. [Common Development Tasks](#common-development-tasks)
8. [Debugging Guide](#debugging-guide)
9. [Testing Strategies](#testing-strategies)
10. [Production Readiness](#production-readiness)
11. [Resources & References](#resources--references)

---

## Prerequisites & Environment Setup

### Required Software

- **Node.js**: 18.x or higher (check with `node --version`)
- **npm**: 9.x or higher (check with `npm --version`)
- **Git**: For version control
- **Code Editor**: VS Code recommended

### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "wix.vscode-import-cost",
    "usernamehw.errorlens"
  ]
}
```

### Optional Tools

- **Postman** or **Insomnia**: For API testing
- **Responsively**: For testing responsive UI
- **Docker**: If deploying with containers (future)

---

## First-Time Setup

### 1. Clone & Install

```bash
# Clone the repository
cd /path/to/keka/chatbot

# Install all dependencies (uses npm workspaces)
npm install

# This installs dependencies for root, backend, and frontend
```

### 2. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your local settings:

```bash
# Backend
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
LOG_LEVEL=info
HASH_SALT=your-random-salt-here

# Frontend
VITE_API_URL=http://localhost:3001
```

**Important:** Never commit your `.env` file with real credentials!

### 3. Generate Document Index (Optional)

```bash
npm run crawl
```

This creates `backend/data/docs.index.json` with stub website content for retrieval testing.

### 4. Start Development Servers

**Option A: Run Both Together (Recommended)**
```bash
npm run dev
```

This uses `concurrently` to run both backend and frontend simultaneously.

**Option B: Run Separately**
```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

### 5. Verify Setup

- Backend: http://localhost:3001/api/health
- Frontend: http://localhost:5173
- Expected: See chatbot home screen with 7 buttons

---

## Understanding the Codebase

### Core Concepts

#### 1. State Machine Pattern

The chatbot uses a finite state machine with 5 states (`backend/src/services/chat.ts:39`):

```typescript
'awaiting_user_choice'  // Home menu, category selection
'awaiting_contact'      // Collecting email/phone
'awaiting_care_for'     // Self or loved one?
'awaiting_setting'      // Care environment selection
'complete'              // Success/end state
```

State transitions are deterministic and driven by user input validation.

#### 2. Request/Response Flow

```
User Input (ChatWidget)
  → POST /api/chat {message, session_id, session_data}
  → PHI Detection (reject if found)
  → State Machine Router (chat.ts)
  → Service Layer (FAQ/Retrieval)
  → Response {text, buttons, links, next_state, session_data}
  → UI Update (React state)
```

#### 3. Session Management

- **Client-Side**: Session ID generated in browser using `crypto.randomUUID()`
- **Stateless Backend**: No server-side session storage
- **Session Data**: Passed in request body, updated in response

#### 4. Security Layers

1. **Input Validation**: Zod schemas (`backend/src/types/schema.ts`)
2. **PHI Detection**: Keyword scanning before processing
3. **URL Allowlist**: Only `kekarehabservices.com` links
4. **Rate Limiting**: 100 req/15min per IP
5. **Privacy Logging**: Hashed IPs, no raw input

### File Organization

#### Backend Structure
```
backend/src/
├── server.ts              # Express app, middleware setup
├── routes/
│   ├── chat.ts            # POST /api/chat endpoint
│   └── handoff.ts         # POST /api/handoff/request
├── services/
│   ├── chat.ts            # State machine orchestration
│   ├── faq.ts             # Knowledge base (7 categories)
│   ├── retrieve.ts        # RAG/embeddings (stub)
│   └── handoff.ts         # Contact validation & storage
├── types/
│   └── schema.ts          # Zod schemas, PHI detection
└── utils/
    └── logger.ts          # Privacy-preserving logging
```

#### Frontend Structure
```
frontend/src/
├── main.tsx               # React entry point
├── App.tsx                # Root component
├── components/
│   ├── ChatWidget.tsx     # Main chat UI (stateful)
│   └── ChatWidget.css     # Component styles
├── api.ts                 # Backend API client
└── types.ts               # TypeScript interfaces
```

### Key Dependencies

**Backend:**
- `express` - Web framework
- `helmet` - Security headers (CSP, HSTS)
- `cors` - Cross-origin resource sharing
- `express-rate-limit` - Rate limiting
- `zod` - Schema validation
- `dotenv` - Environment variables
- `tsx` - TypeScript execution (dev)

**Frontend:**
- `react` - UI library
- `react-dom` - React rendering
- `vite` - Build tool (fast HMR)

---

## Development Workflow

### Running Development Servers

```bash
# Start both frontend + backend
npm run dev

# Backend only (port 3001)
npm run dev -w backend

# Frontend only (port 5173)
npm run dev -w frontend
```

### Building for Production

```bash
# Build both workspaces
npm run build

# Build backend only (compiles TypeScript to dist/)
npm run build -w backend

# Build frontend only (bundles to dist/)
npm run build -w frontend
```

### Type Checking

```bash
# Check types without emitting files
npm run type-check -w backend
npm run type-check -w frontend
```

### Hot Reload & Development

- **Backend**: Uses `tsx watch` - changes auto-reload
- **Frontend**: Uses Vite HMR - instant updates
- **Both**: Keep both terminals open for full-stack development

---

## Code Conventions

### TypeScript Style

#### Naming Conventions

```typescript
// Interfaces & Types: PascalCase
interface BotResponse { }
type ChatRequest = { }

// Functions: camelCase
function handleChatMessage() { }
async function retrieveDocuments() { }

// Constants: UPPER_SNAKE_CASE
const PHI_KEYWORDS = ['ssn', 'diagnosis'];
const ALLOWED_DOMAINS = ['kekarehabservices.com'];

// Enums: PascalCase with PascalCase values
enum StateType {
  AwaitingUserChoice = 'awaiting_user_choice',
  Complete = 'complete',
}
```

#### File Naming

- **Components**: `PascalCase.tsx` (e.g., `ChatWidget.tsx`)
- **Services**: `camelCase.ts` (e.g., `chat.ts`, `retrieve.ts`)
- **Types**: `schema.ts` or `types.ts`
- **Utils**: `camelCase.ts` (e.g., `logger.ts`)

### Code Organization

#### 1. Imports Order

```typescript
// 1. External libraries
import express from 'express';
import { z } from 'zod';

// 2. Internal types
import { BotResponse, ChatRequest } from '../types/schema';

// 3. Internal services/utils
import { handleChatMessage } from '../services/chat';
import { logger } from '../utils/logger';
```

#### 2. Function Structure

```typescript
// 1. Type definitions
export interface HandoffRecord { }

// 2. Helper functions (private)
function validateEmail(email: string): boolean { }

// 3. Main exported functions
export function saveHandoffRequest(request: HandoffRequest): HandoffRecord {
  // Validate
  // Process
  // Log
  // Return
}
```

### EditorConfig Settings

The project uses `.editorconfig`:

```
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2
```

### TypeScript Configuration

**Backend** (`backend/tsconfig.json`):
- Target: ES2022
- Module: CommonJS (Node.js)
- Strict mode enabled
- Source maps for debugging

**Frontend** (`frontend/tsconfig.json`):
- Target: ES2020
- Module: ESNext (bundler-optimized)
- JSX: React 18 automatic runtime
- Strict mode + unused variable checks

---

## Critical Knowledge: HIPAA & Security

### What is PHI (Protected Health Information)?

PHI includes any information that can identify a patient and relates to their health:

- Names, addresses, dates (except year)
- Social Security Numbers
- Medical record numbers
- Diagnosis, medications, procedures
- Test results, lab values
- Insurance information

### PHI Detection System

Located in `backend/src/types/schema.ts:55`:

```typescript
export const PHI_KEYWORDS = [
  'ssn', 'social security',
  'dob', 'date of birth', 'birthday',
  'diagnosis', 'diagnosed',
  'prescription', 'medication',
  'surgery', 'blood pressure',
  'test result', 'lab result',
  'insurance id', 'policy number',
];

export function containsPHI(text: string): boolean {
  const lower = text.toLowerCase();
  return PHI_KEYWORDS.some(keyword => lower.includes(keyword));
}
```

**When to Add Keywords:**
- Medical terms (e.g., "chemotherapy", "diabetes")
- Specific procedures (e.g., "colonoscopy")
- Clinical measurements (e.g., "glucose level", "heart rate")

### Security Rules for Developers

#### ❌ DO NOT:

1. **Log raw user input** - Only log event types and metadata
2. **Store PHI** - This system NEVER stores medical information
3. **Allow external URLs** - Only `kekarehabservices.com` in link cards
4. **Bypass validation** - Always use Zod schemas
5. **Skip rate limits** - Keep security middleware active
6. **Commit .env files** - Use `.env.example` for templates

#### ✅ DO:

1. **Hash sensitive data** - Use `logger.hashIP()` for IPs
2. **Validate all inputs** - Use Zod schemas for requests/responses
3. **Test PHI detection** - Add test cases when modifying keywords
4. **Use HTTPS in prod** - Always enforce secure transport
5. **Document security decisions** - Comment why security checks exist

### Logging Best Practices

**Good Logging** (`backend/src/utils/logger.ts`):

```typescript
// ✅ Good: Event-based, no raw input
logger.info('chat_message_received', {
  session_id: request.session_id,
  ip_hash: ipHash,
  message_length: message.length,
});

// ✅ Good: PHI detection logged
logger.warn('phi_detected', {
  session_id: request.session_id,
  ip_hash: ipHash,
});

// ❌ Bad: Logging raw user input
logger.info('user_said', { message: request.message }); // NEVER DO THIS
```

### URL Allowlist

Only these domains are permitted (`backend/src/types/schema.ts:78`):

```typescript
export const ALLOWED_DOMAINS = [
  'kekarehabservices.com',
  'www.kekarehabservices.com',
];

export function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_DOMAINS.some(domain =>
      parsed.hostname === domain ||
      parsed.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}
```

**When adding links**, verify they pass this check or update the allowlist (with approval).

---

## Common Development Tasks

### Task 1: Add a New FAQ Question

**Location:** `backend/src/services/faq.ts`

```typescript
// 1. Find the appropriate category
export const FAQ_CATEGORIES: Record<string, FAQCategory> = {
  therapy_rehab: {
    id: 'therapy_rehab',
    emoji: '🏥',
    label: 'Therapy & Rehabilitation',
    questions: [
      // 2. Add your new question
      {
        id: 'new_question_id',  // Unique snake_case ID
        question: 'Your question text?',
        answer: 'Your detailed answer here.',
        links: [  // Optional
          {
            title: 'Learn More',
            url: 'https://kekarehabservices.com/page/',
            description: 'Additional context',
          },
        ],
      },
      // ... existing questions
    ],
  },
};

// 3. Add button to getCategoryButtons() if needed
```

**Testing:**
1. Restart backend (`npm run dev -w backend`)
2. Navigate to category in UI
3. Verify question appears and answer displays correctly

### Task 2: Add a New State to the State Machine

**Location:** `backend/src/services/chat.ts`

```typescript
// 1. Update the state type in schema.ts
export const BotResponseSchema = z.object({
  next_state: z.enum([
    'awaiting_user_choice',
    'awaiting_contact',
    'awaiting_care_for',
    'awaiting_setting',
    'awaiting_new_state',  // Add here
    'complete',
  ]),
});

// 2. Add handler in chat.ts
export async function handleChatMessage(request: ChatRequest): Promise<BotResponse> {
  const currentState = session_data?.state || 'awaiting_user_choice';

  switch (currentState) {
    case 'awaiting_new_state':
      return handleAwaitingNewState(message, sessionData);
    // ... other cases
  }
}

// 3. Implement handler function
function handleAwaitingNewState(message: string, sessionData: any): BotResponse {
  // Your logic here
  return {
    text: 'Response text',
    buttons: [{ label: 'Next', value: 'next_action' }],
    next_state: 'awaiting_user_choice',
    session_data: sessionData,
  };
}
```

### Task 3: Add a New API Endpoint

**Step 1: Define schema** (`backend/src/types/schema.ts`):

```typescript
export const NewRequestSchema = z.object({
  field: z.string().max(100),
  session_id: z.string().uuid(),
});

export type NewRequest = z.infer<typeof NewRequestSchema>;
```

**Step 2: Create route** (`backend/src/routes/newRoute.ts`):

```typescript
import { Router, Request, Response } from 'express';
import { NewRequestSchema } from '../types/schema';
import { logger } from '../utils/logger';
import { ZodError } from 'zod';

const router = Router();

router.post('/new-endpoint', async (req: Request, res: Response) => {
  try {
    const validated = NewRequestSchema.parse(req.body);

    // Your logic here

    res.json({ success: true });
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn('validation_error', { errors: error.errors });
      return res.status(400).json({ error: 'Invalid request' });
    }
    logger.error('endpoint_error', { error: String(error) });
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
```

**Step 3: Register in server** (`backend/src/server.ts`):

```typescript
import newRouter from './routes/newRoute';

app.use('/api', newRouter);
```

### Task 4: Modify Frontend API Client

**Location:** `frontend/src/api.ts`

```typescript
export async function callNewEndpoint(data: any): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/new-endpoint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
```

### Task 5: Update PHI Keywords

**Location:** `backend/src/types/schema.ts:55`

```typescript
export const PHI_KEYWORDS = [
  // Existing keywords...

  // Add new keywords (lowercase)
  'new_medical_term',
  'another_phi_keyword',
];
```

**Testing:**
1. Restart backend
2. Try typing the new keyword in chat
3. Verify PHI warning appears
4. Check logs for `phi_detected` event

---

## Debugging Guide

### Common Issues

#### 1. Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3001`

**Solution:**
```bash
# Find process using the port
lsof -i :3001

# Kill the process
kill -9 <PID>

# Or use fuser (Linux)
fuser -k 3001/tcp
```

#### 2. CORS Errors

**Error:** `Access to fetch at 'http://localhost:3001/api/chat' from origin 'http://localhost:5173' has been blocked`

**Solution:**
1. Check `.env` has correct `FRONTEND_URL=http://localhost:5173`
2. Restart backend after changing `.env`
3. Verify CORS config in `backend/src/server.ts:40`

#### 3. TypeScript Errors After Install

**Error:** `Cannot find module 'express'` or similar

**Solution:**
```bash
# Clean install
rm -rf node_modules package-lock.json
rm -rf backend/node_modules frontend/node_modules
npm install

# If still broken, check Node version
node --version  # Should be 18+
```

#### 4. Frontend Not Loading

**Issue:** White screen or React errors

**Solution:**
1. Check browser console for errors
2. Verify API_URL in `.env`: `VITE_API_URL=http://localhost:3001`
3. Restart Vite dev server
4. Clear browser cache (Cmd+Shift+R / Ctrl+F5)

### Debugging Techniques

#### Backend Debugging

**1. Add Debug Logs:**
```typescript
logger.debug('debug_event', {
  data: JSON.stringify(someVariable)
});
```

**2. Use tsx Debugger:**
```bash
# In backend directory
node --inspect node_modules/.bin/tsx watch src/server.ts
```

Then attach Chrome DevTools: `chrome://inspect`

**3. Check Backend Health:**
```bash
curl http://localhost:3001/api/health
```

#### Frontend Debugging

**1. React DevTools:**
Install React DevTools browser extension

**2. Console Logging:**
```typescript
console.log('Session data:', sessionData);
console.log('Current state:', messages);
```

**3. Network Tab:**
- Open browser DevTools (F12)
- Network tab → Filter by `chat` or `handoff`
- Inspect request/response payloads

### Log Analysis

**Backend logs are JSON:**

```json
{"timestamp":"2024-10-05T12:34:56.789Z","level":"info","event_type":"chat_message_received","session_id":"abc-123","ip_hash":"a1b2c3","message_length":42}
```

**Key log events:**
- `server_started` - Backend initialized
- `chat_message_received` - User sent message
- `phi_detected` - PHI keyword found (IMPORTANT)
- `handoff_request_created` - Contact capture
- `validation_error` - Schema validation failed
- `unhandled_error` - Something went wrong

---

## Testing Strategies

### Manual Testing Checklist

#### Core Flows

- [ ] Home screen shows 7 buttons
- [ ] "Start Intake" → email/phone → care recipient → setting → success
- [ ] All 7 categories load with sub-questions
- [ ] FAQ answers include links (clickable, open in new tab)
- [ ] "Did this help?" resolution checks appear
- [ ] "Contact me" button triggers intake flow
- [ ] PHI keywords rejected with warning message
- [ ] "Back to Home" button returns to main menu

#### Security Checks

- [ ] Test PHI keywords: "My diagnosis is...", "SSN 123-45-6789"
- [ ] Verify warning message appears
- [ ] Check backend logs - no raw message content
- [ ] Verify all links go to `kekarehabservices.com`
- [ ] Test rate limiting: Make 101+ requests rapidly

### API Testing with curl

**Test Chat Endpoint:**
```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "start",
    "session_id": "550e8400-e29b-41d4-a716-446655440000",
    "session_data": {}
  }'
```

**Expected Response:**
```json
{
  "text": "Welcome! How can Keka help you today?",
  "buttons": [
    {"label": "✅ Start Intake / Request Care", "value": "start_intake"},
    ...
  ],
  "next_state": "awaiting_user_choice"
}
```

**Test Handoff Endpoint:**
```bash
curl -X POST http://localhost:3001/api/handoff/request \
  -H "Content-Type: application/json" \
  -d '{
    "contact_type": "email",
    "contact_value": "test@example.com",
    "care_for": "self",
    "care_setting": "in_home",
    "session_id": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

### PHI Detection Tests

**Test these inputs - all should be rejected:**

```
"My SSN is 123-45-6789"
"I was diagnosed with cancer"
"My medication is metformin"
"Date of birth: 01/01/1980"
"Blood pressure is 120/80"
"Insurance ID: ABC123456"
```

**Expected:** Warning message + "Back to Home" button

### Automated Testing (Future)

The project currently lacks unit tests. To add:

```bash
# Install testing frameworks
npm install -D jest @types/jest ts-jest supertest @types/supertest

# Create test files
touch backend/src/services/__tests__/chat.test.ts
```

**Example test:**
```typescript
import { containsPHI } from '../types/schema';

describe('PHI Detection', () => {
  it('should detect SSN in message', () => {
    expect(containsPHI('My SSN is 123-45-6789')).toBe(true);
  });

  it('should allow safe messages', () => {
    expect(containsPHI('I need help with therapy')).toBe(false);
  });
});
```

---

## Production Readiness

### Environment Variables

**Required for Production:**

```bash
# Backend
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
LOG_LEVEL=warn
HASH_SALT=<secure-random-string>

# Optional: Embeddings service
AZURE_OPENAI_ENDPOINT=https://your-instance.openai.azure.com
AZURE_OPENAI_KEY=<your-key>
AZURE_OPENAI_DEPLOYMENT=text-embedding-ada-002
```

### Database Migration

**Current:** JSON files in `backend/data/` (dev only)

**Production:** Replace with HIPAA-compliant database

```typescript
// backend/src/services/handoff.ts - Replace file system with DB

// Before (dev):
fs.writeFileSync(handoffsPath, JSON.stringify(handoffs));

// After (prod):
await db.handoffs.create({
  data: record,
});
```

**Recommended Databases:**
- AWS RDS (with encryption at rest)
- Azure SQL Database (HIPAA-compliant tier)
- Google Cloud SQL (with encryption)

### Security Hardening

#### 1. HTTPS Only

```typescript
// backend/src/server.ts
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});
```

#### 2. Stricter Rate Limits

```typescript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,  // Reduce from 100 to 50
  message: 'Too many requests',
});
```

#### 3. Helmet Configuration

Already configured in `backend/src/server.ts:17`. Verify CSP directives match your CDN/assets.

#### 4. Environment Validation

```typescript
// backend/src/server.ts
if (process.env.NODE_ENV === 'production') {
  if (!process.env.HASH_SALT) {
    throw new Error('HASH_SALT must be set in production');
  }
}
```

### Build & Deploy

**Build for Production:**
```bash
npm run build
```

**Start Production Server:**
```bash
# Backend only (frontend served by CDN/Nginx)
cd backend
npm start
```

**Docker (Future):**
```dockerfile
# Example Dockerfile for backend
FROM node:18-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --only=production
COPY backend/dist ./dist
CMD ["node", "dist/server.js"]
```

### Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use secure `HASH_SALT` (min 32 chars)
- [ ] Enable HTTPS with valid SSL certificate
- [ ] Configure database with encryption at rest
- [ ] Set up log aggregation (CloudWatch, DataDog)
- [ ] Enable API monitoring (response times, errors)
- [ ] Configure backups for database
- [ ] Set up alerts for PHI detection events
- [ ] Document incident response plan
- [ ] Schedule security audits

---

## Resources & References

### Project Documentation

- `README.md` - Project overview and quick start
- `ARCHITECTURE.md` - High-level architecture deep dive
- `TESTING.md` - Manual testing guide
- This file - Comprehensive developer guide

### TypeScript & React

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Docs](https://react.dev/)
- [Zod Documentation](https://zod.dev/)

### Security & HIPAA

- [HIPAA Privacy Rule](https://www.hhs.gov/hipaa/for-professionals/privacy/index.html)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Helmet.js Documentation](https://helmetjs.github.io/)

### Node.js & Express

- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

### RAG & Embeddings (Future)

- [Azure OpenAI Embeddings](https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/embeddings)
- [AWS Bedrock Knowledge Bases](https://aws.amazon.com/bedrock/knowledge-bases/)
- [Vector Databases Comparison](https://www.pinecone.io/learn/vector-database/)

### Tools & CLI

```bash
# Useful commands reference

# Check all TypeScript files for errors
npx tsc --noEmit

# Format code (if prettier is added)
npx prettier --write "src/**/*.{ts,tsx}"

# Check for outdated dependencies
npm outdated

# Audit for security vulnerabilities
npm audit

# Generate dependency graph
npm ls
```

---

## Getting Help

### Common Questions

**Q: How do I add a new service category?**
A: See "Task 1: Add a New FAQ Question" - add to `FAQ_CATEGORIES` in `faq.ts`

**Q: How do I change the PHI keywords?**
A: Edit `PHI_KEYWORDS` in `backend/src/types/schema.ts:55`

**Q: How do I add logging to my code?**
A: Use `logger.info('event_name', { key: value })` - see `backend/src/utils/logger.ts`

**Q: Where are handoff requests stored?**
A: Currently in `backend/data/handoffs.json` (dev only)

**Q: How do I test the API without the frontend?**
A: Use curl commands in "API Testing with curl" section

### Troubleshooting Decision Tree

```
Issue: Something's not working
  ├─ Backend not starting?
  │   ├─ Port in use? → Kill process (lsof -i :3001)
  │   ├─ Missing deps? → npm install
  │   └─ .env correct? → Check FRONTEND_URL, PORT
  │
  ├─ Frontend not loading?
  │   ├─ White screen? → Check browser console
  │   ├─ CORS error? → Verify .env, restart backend
  │   └─ API errors? → Check VITE_API_URL
  │
  └─ Logic issue?
      ├─ Check backend logs (JSON in terminal)
      ├─ Add debug logging
      └─ Test endpoint with curl
```

---

## Quick Reference Card

### Development Commands

```bash
npm run dev              # Start both frontend + backend
npm run dev -w backend   # Backend only
npm run dev -w frontend  # Frontend only
npm run build            # Build for production
npm run crawl            # Generate docs index
```

### Key Files to Know

```
backend/src/server.ts           # Express app setup
backend/src/services/chat.ts    # State machine
backend/src/services/faq.ts     # Knowledge base
backend/src/types/schema.ts     # Validation + PHI
frontend/src/components/ChatWidget.tsx  # Main UI
.env                            # Configuration (local only)
```

### Important URLs

```
http://localhost:3001/api/health    # Backend health check
http://localhost:3001/api/chat      # Chat endpoint
http://localhost:5173               # Frontend dev server
```

### Remember

1. **Never log raw user input** - Use event-based logging
2. **Always validate with Zod** - Schemas in `schema.ts`
3. **Test PHI detection** - Before deploying changes
4. **Restart backend after .env changes** - Env loaded at startup
5. **Keep frontend/backend in sync** - Types should match

---

**Happy coding! Build secure, compliant, and compassionate software.** 🩺
