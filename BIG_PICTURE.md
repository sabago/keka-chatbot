🧭 Big Picture — Keka Rehab Services Support Chatbot

Project Goal:
Build a brand-new, HIPAA-compliant, click-first customer support chatbot for Keka Rehab Services, implemented in React + Vite (frontend) and Node/Express (backend) with TypeScript.

The chatbot will guide users through therapy, home care, and staffing questions — and smoothly convert qualified visitors into intake leads (phone or email) while maintaining strict HIPAA compliance and providing an option to speak with a human safely.

⸻

🏗️ Overview

Core Objectives
	•	Provide a friendly, guided chat experience using buttons, chips, and short answers.
	•	Replace open-ended typing with structured options to prevent PHI leakage.
	•	Allow users to request contact via phone or email only.
	•	Provide a “Speak with a Human” feature to escalate safely to staff.
	•	Deliver clear, helpful information drawn from FAQs and public website pages.
	•	Maintain HIPAA-level security and data minimization throughout.

System Tiers
	1.	Tier 1: FAQs
Predefined Q&A pairs drawn from Keka’s official FAQ copy. Deterministic responses.
	2.	Tier 2: RAG (Retrieval-Augmented Generation)
Search public website content (About, What We Do, Health Hub, etc.) for related info using vector similarity (stub embeddings).
	3.	Tier 3: (Optional Future)
HIPAA-compliant LLM backend (Azure OpenAI / Bedrock) — NOT included in MVP.

⸻

🧠 Conversational Design

Entry Point: Click-First Menu

When the user opens the chat widget, they see eight main options:

Label	Description
✅ Start Intake / Request Care	Leads directly to the intake flow (contact capture).
🏥 Therapy & Rehabilitation	Service info and scheduling questions.
🩺 Home Care & Caregiver Services	Caregiver, dementia, and home assistance questions.
👩‍⚕️ Staffing & Agency Support	For B2B agencies needing placement or consulting.
💳 Insurance & Billing Questions	Coverage, claims, paperwork, and telehealth info.
🛠️ Home Safety & Equipment Help	Fall prevention, mobility aids, and safety assessments.
🏘️ Community Programs & Marketplace	Health Hub, events, and product sales.
🧍 Speak with a Human	Allows users to request direct follow-up from Keka staff.


⸻

🧾 Intake Flow (High-Priority Conversion Path)

If user clicks Start Intake / Request Care or any “Contact me” CTA:
	1.	Ask: “Great — can you share your phone or email so our team can reach you?”
	2.	Ask (optional): “Is the care for you or a loved one?”
	3.	Ask (optional): “Which setting do you prefer: In-home, Adult Day Health, or Clinic Visit?”
	4.	Confirm: “Thanks — our care coordinator will reach out within business hours.”
→ next_state: complete

⸻

🧍 “Speak with a Human” Feature

🎯 Purpose

Enable users to request a human conversation (phone call or secure follow-up) from within the chatbot flow, while remaining fully HIPAA-compliant and non–real-time.

This ensures users can always reach a real person — without collecting or exposing medical details in chat.

🔁 Trigger Points
	1.	Top-Level Button: 🧍 Speak with a Human
(immediate access for users preferring a real person)
	2.	Resolution Check: After each answer — [No — Speak with a Human 📞]
	3.	PHI Refusal: When PHI is detected — prompt for phone/email contact.

🧩 Flow

User clicks “Speak with a Human” →
  Bot: “Sure! What’s the best way to reach you?”
    → Buttons: [📧 Email] [📞 Phone]
  User chooses one →
    Bot: “Please enter your {email/phone} below.”
  Validate input (RFC 5322 or E.164)
  Bot: “Thank you! Our team will contact you within 1 business day.”
  next_state: complete

🧱 Backend Schema

ContactRequest = {
  session_id: uuid;
  channel: "email" | "phone";
  email?: string;
  phone?: string;
  topic?: string;              // e.g. "therapy", "billing"
  non_phi_context?: string;    // short, sanitized context
}

🔒 Compliance

Area	Rule
PHI Handling	No medical details accepted or stored.
Data Stored	Only phone/email, topic, and short context.
Access	Authorized staff only; encrypted storage.
Logging	No raw contact data; event + session_id only.
Encryption	Encrypt contact info at rest; always use HTTPS.
Fallback	After repeated invalid input, suggest direct phone call.

📞 Integration
	•	Immediate MVP: Save encrypted contact in local file or DB.
	•	Later Phase: Integrate with HIPAA-compliant CRM (HubSpot, Salesforce, etc.) via background queue.

⸻

🗂️ Category Flows

Each main category opens 3–5 pre-defined FAQ-style questions (chips).
After each answer:
	•	Show “Did this solve it?” → [Yes ✅] [No — Speak with a Human 📞]
	•	“Contact me” redirects to the same intake/handoff flow.

Examples:

Therapy & Rehabilitation
	•	“What types of therapy do you offer?”
	•	“Can therapy be done at home?”
	•	“Do you offer stroke recovery programs?”
	•	“Do you provide exercise programs for seniors?”
→ Ends with intake CTA.

Home Care & Caregiver Services
	•	“Can you provide caregivers for disabilities?”
	•	“Do you support dementia care?”
	•	“Can I request the same caregiver each time?”
	•	“What training do your caregivers have?”
→ Ends with intake CTA.

…and similar for all other categories.

⸻

🔒 HIPAA & Security Requirements
	•	PHI Guardrails:
Detect keywords like “diagnosis,” “DOB,” “insurance ID,” “claim,” “MRN,” “medication.”
If detected → immediately refuse and show safe message:
“I can’t process medical details here. For clinical questions, please call (857) 345-9589 or dial 911 for emergencies.”
	•	Allowed Inputs:
	•	Email (validated RFC 5322)
	•	Phone (validated E.164)
	•	No freeform messages or medical info.
	•	Data Logging:
	•	Log only event type, session_id, hashed IP.
	•	Never log user messages.
	•	Storage:
	•	Contact info encrypted at rest.
	•	Frontend Disclaimer (always visible):
“🚨 Not for emergencies — call 911. Don’t include medical details.”

⸻

⚙️ Technical Architecture

Frontend
	•	Framework: React + Vite + TypeScript
	•	Core Components:
	•	ChatWidget.tsx — Main chat UI
	•	lib/api.ts — API client
	•	types.ts — Shared schema
	•	State Machine:
awaiting_user_choice → awaiting_contact → complete
	•	UI Behavior:
	•	Message bubbles + buttons
	•	Link cards open in new tab
	•	Always show disclaimer footer
	•	Soft animation + scroll auto-focus
	•	Separate flows for “Intake” and “Speak with a Human”

Backend
	•	Framework: Express + TypeScript
	•	Routes:
	•	/api/chat — handles intents, FAQ, RAG, and PHI detection
	•	/api/handoff/request — stores contact or handoff request
	•	/api/events — logs anonymized analytics
	•	Services:
	•	faq.ts — keyword match for FAQs
	•	retrieve.ts — vector similarity search
	•	embedding.ts — deterministic local embeddings
	•	Validation:
	•	Zod schemas in schema.ts
	•	Security:
	•	Helmet, rate-limit, CORS (FRONTEND_URL), cookie-parser

Data
	•	data/faq.json — static FAQ dataset
	•	data/docs.index.json — RAG index
	•	scripts/crawl-keka.ts — CLI crawler to build docs index

⸻

📦 Folder Structure

/keka-chatbot
│
├── backend/
│   ├── src/
│   │   ├── routes/ (chat.ts, handoff.ts, events.ts)
│   │   ├── services/ (faq.ts, retrieve.ts, embedding.ts)
│   │   ├── utils/ (schema.ts, allowlist.ts, logger.ts)
│   │   ├── data/ (faq.json, docs.index.json)
│   │   └── server.ts
│   ├── test/
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/ChatWidget.tsx
│   │   ├── lib/api.ts
│   │   ├── types.ts
│   │   └── main.tsx
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── scripts/
│   └── crawl-keka.ts
│
├── shared/
│   └── types.ts
│
├── .env.example
├── README.md
└── package.json


⸻

🧩 Data Flow Summary

User → ChatWidget → /api/chat → FAQ/RAG → BotPayload schema → buttons/links
→ (If intake or human) /api/handoff/request → Save contact → Thank-you message


⸻

🧪 Acceptance Criteria

Category	Criteria
Schema Validation	All responses match BotPayload.
HIPAA Compliance	PHI input triggers safe refusal.
Allow-List Enforcement	Only approved Keka URLs shown.
CORS Security	Only FRONTEND_URL allowed.
Logging	No raw user text in logs.
UX	Home shows 8 top-level buttons including “Speak with a Human”.
Forms	Email/phone validated, submission confirmed.
Accessibility	Keyboard focus + ARIA labels supported.


⸻

🚀 MVP Deliverables
	1.	React widget embeddable in Keka’s website.
	2.	Node backend (Express API) with PHI guard + schema validation.
	3.	Static FAQ and RAG data.
	4.	Intake + Speak with a Human contact flow.
	5.	Helmet, CORS, rate limit, input validation.
	6.	Documentation + crawler script.

⸻

📈 Future Enhancements
	•	Live secure chat integration (Twilio, CometChat, or SignalR).
	•	Postgres + pgvector for embeddings.
	•	Admin dashboard for handoff queue.
	•	Multilingual support.
	•	CRM integration (HubSpot, Salesforce Health Cloud).

⸻

Summary

The Keka Rehab chatbot prioritizes clarity, compliance, and care.
It uses guided menus instead of open text, safely escalates users to human follow-up, and captures intake information under strict HIPAA rules — ensuring Keka remains a trusted partner in patient-centered rehabilitation.
