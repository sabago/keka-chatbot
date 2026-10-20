# Keka Chatbot

Website chat widget for Keka Rehab Services, a Boston-area rehab and home care provider, embedded on kekarehabservices.com (WordPress). Visitors browse FAQs or leave contact details through one of three intake flows (patient/client, accreditation and consulting, staffing and employment), and staff follow up by phone or email. Visitors can type anything, so treat every message as possible PHI.

## Stack

- npm workspaces. `backend/`: Express and TypeScript (CommonJS), zod, Postgres through `pg`, email through AWS SES. `frontend/`: React, Vite, Tailwind.
- Production is a single Railway service. The backend build also builds the frontend into `backend/dist/public` and serves it, so the API is same-origin and `VITE_API_URL` is empty in production.
- The WordPress site loads `frontend/public/embed.js`, which injects the app in an iframe and opens it only on click. `embed.js` must stay cross-origin readable (the server sets its CORP header). The sites allowed to frame the app come from `ALLOWED_EMBED_DOMAINS`, which feeds the CSP `frame-ancestors`.

## Commands

```bash
npm run dev                     # backend on :3001, frontend on :5173
npm run type-check -w backend
npm run type-check -w frontend
npm run build                   # the backend build includes the frontend
npm run crawl                   # regenerates backend/data/docs.index.json (stub content)
```

There are no test or lint scripts. Verify a change with both type-checks and by running the flow, in the UI or with `curl -X POST localhost:3001/api/chat` (`session_id` must be a UUID).

npm runs workspace scripts from the workspace directory, so the backend reads `backend/.env` and Vite reads `frontend/.env*`. Nothing reads a root `.env`.

An unset `NODE_ENV` counts as development. In development SES is never called: emails are printed to the console, and only if `SES_FROM_EMAIL` and `ADMIN_EMAIL` are set. Without `DATABASE_URL`, handoffs are written to `backend/data/handoffs.json`.

## HIPAA

- The chatbot collects no health information. Patient intake asks only for a name, contact details, who the care is for and the care setting; staff gather clinical and insurance details by phone. Don't add questions, fields or email content that collect health details.
- `HandoffRequestSchema` strips unknown keys, so a new handoff field must be added there on purpose, and it must not be health information.
- Every chat message goes through `containsPHI` (a lowercase keyword match against `PHI_KEYWORDS` in `backend/src/types/schema.ts`) before anything else handles it. A match is rejected, and the visitor is sent back to the home menu.
- Never log, store or email raw message text or the chat transcript. Log event names and metadata (lengths, ids, states), with IPs hashed by `logger.hashIP()`. Handoff emails leave the transcript out deliberately.
- Analytics event metadata (`/api/events`, `saveEvent`) must not carry message text or contact details. Analytics calls are fire-and-forget and must never delay or break a reply.
- In production, handoff records (personal contact details) go only to Postgres. A failed database save logs `handoff_not_persisted` and relies on the email; don't add a disk fallback outside development.
- Set `HASH_SALT` in every deployed environment. Without it, `logger.hashIP` uses a fixed default salt.
- Link cards may only point at kekarehabservices.com (`isAllowedUrl`). Widening `ALLOWED_DOMAINS` needs the user's approval.
- `scripts/purge-handoff-phi.sql` strips old health fields from existing handoff rows. Run it only when the user asks, after a Railway database backup.

## Conversation state

- The backend keeps no sessions. The client sends `session_data` (current state, answers so far, back-navigation history) with every request, and each response returns the updated copy. That's why the JSON body limit is 1 MB.
- The states are the `next_state` enum in `BotResponseSchema`. Every response is validated against it, so returning a state that isn't in the enum is a 500.
- A new state needs the enum entry, a case in the router in `handleChatMessage` (`backend/src/services/chat.ts`), and a case in `restoreStateResponse`; without the last one, Back from that state drops to the home screen.
- `home`, `start` and `back` are reserved messages, handled before the router.
- The home menu is `TOP_LEVEL_MENU` and the FAQ content is `FAQ_CATEGORIES`, both in `backend/src/services/faq.ts`.

## API

- CORS allows only GET and POST and only the `Content-Type` header. A new request header must also be added to the `cors()` config in `backend/src/server.ts`.
- `/api/` is rate-limited to 100 requests per 15 minutes per IP, behind Railway's proxy (`trust proxy` is on).
- Chat, handoff and event requests are validated with zod, and `/api/chat` also validates its response. Validate any new request body the same way.
- `/api/analytics/*` requires `Authorization: Bearer <ANALYTICS_API_KEY>` and returns 404 when the key isn't set. Nothing in the app calls these routes; `POST /api/analytics/send-report` emails the weekly report.
- Times in emails and the weekly report use `America/New_York` (`EMAIL_TIME_ZONE`), because the business is in Massachusetts.
