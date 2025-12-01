# Copilot / AI Assistant Instructions for Keka Chatbot

Quick, focused guidance so an AI coder can be productive immediately.

1) Big picture
- Monorepo with two primary workspaces: `backend/` (Express + TypeScript) and `frontend/` (React + Vite).
- Backend is stateless for sessions: the client sends `session_id` and `session_data`; state machine lives in `backend/src/services/chat.ts`.
- PHI detection and Zod validation are central to request flow (`backend/src/types/schema.ts`). Never alter PHI logic without reviewing HIPAA notes in `CLAUDE.md`.

2) Key entry points & examples
- Backend start: `backend/src/server.ts` — middleware, rate limits, and routes are configured here.
- Chat endpoint: `backend/src/routes/chat.ts` → orchestrates `services/chat.ts` and uses `types/schema.ts`.
- Frontend main: `frontend/src/main.tsx`, UI component: `frontend/src/components/ChatWidget.tsx`.
- Logging: `backend/src/utils/logger.ts` (privacy-preserving; IPs are hashed).

3) Important files to read before edits
- `CLAUDE.md` — project-specific developer guide and HIPAA/security constraints.
- `backend/src/types/schema.ts` — PHI keyword set and input schemas (primary safety net).
- `backend/jobs/weeklyReport.ts` — scheduled report job; env-driven (`.env.example` has `WEEKLY_REPORT_*`).
- `backend/db/schema.sql` and `backend/db/init.ts` — DB schema and initialization.

4) Scripts & developer commands
- Install: `npm install` (root uses npm workspaces).
- Dev (both): `npm run dev` (concurrently runs backend + frontend).
- Backend dev: `cd backend && npm run dev` or `npm run dev -w backend`.
- Frontend dev: `cd frontend && npm run dev` or `npm run dev -w frontend`.
- Build both: `npm run build` (root). Backend build also copies SQL and frontend dist (`backend/package.json` scripts).
- Type check: `npm run type-check -w backend` and `-w frontend`.

5) Conventions and patterns (do this project’s way)
- Indentation: 2 spaces, final newline, LF (see `.editorconfig`).
- TypeScript: strict mode enabled. Run `tsc --noEmit` for checks.
- Naming: components PascalCase (`ChatWidget.tsx`), services and utils camelCase (`chat.ts`, `logger.ts`).
- Imports order: external libs → internal types → services/utils.

6) Safety & HIPAA-specific rules (must-follow)
- PHI detection: Any code touching message content must use existing `containsPHI()` logic in `backend/src/types/schema.ts` before processing or logging.
- Logging: Use `backend/src/utils/logger.ts` helpers to avoid writing raw identifiers or PHI to logs.
- External links: Only allow `kekarehabservices.com` and other allowlisted domains implemented in the code.
- Secrets: Use `.env` (local) and never commit credentials. `.env.example` lists required vars (SES, SNS, WEEKLY_REPORT_*).

7) Integration points & external services
- Email: AWS SES (`AWS_REGION`, `SES_FROM_EMAIL`) — backend uses `@aws-sdk/client-ses`.
- SMS: AWS SNS (optional) via `@aws-sdk/client-sns`.
- Postgres: `pg` client referenced; DB URL comes from `DATABASE_URL` in env (Railway sets this in prod).

8) When making changes: quick checklist
- Run type checks: `npm run type-check -w backend && npm run type-check -w frontend`.
- Run the stack locally: `npm run dev` and verify `/api/health` and the frontend UI at `http://localhost:5173`.
- Add unit/type tests where appropriate and update `CLAUDE.md` notes if behavior or PHI keywords change.

9) Useful examples (copyable snippets)
- Check PHI before processing a message:
  ```ts
  import { containsPHI } from '../types/schema';
  if (containsPHI(message)) { return { error: 'PHI detected' }; }
  ```

10) Where to look for more context
- High-level developer guide: `CLAUDE.md` (root).
- Analytics & retention: `backend/src/services/analytics.ts` and `.env.example` (`ANALYTICS_*`).

If anything here is unclear or you'd like more detail about a specific area (jobs, build, PHI list, or a code walk-through), tell me which part to expand. 
