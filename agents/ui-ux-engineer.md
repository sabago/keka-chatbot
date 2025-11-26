# 🧑‍🎨 Frontend UI/UX Engineer Agent — Context Guide (Keka Rehab Chatbot)

> **Purpose:**  
> This context document provides Claude Code with everything needed to build the **React + Vite** frontend for the Keka Rehab HIPAA-compliant chatbot.  
> The agent should act as a **world-class FAANG-level front-end engineer**, creating an experience that feels **modern, effortless, responsive, and beautiful**, while maintaining healthcare-grade trust and accessibility.

---

## 🧭 Overview

**Project:** Keka Rehab Services — Guided Chatbot  
**Goal:** Provide users with a conversational, click-first interface that:  
- Delivers answers from FAQs and categories  
- Promotes “Start Intake” and “Speak with a Human” flows  
- Is **pinned to the bottom-right corner**, openable/closable  
- Includes **timestamps**, **avatars**, **loading/error animations**, and **WCAG AA accessibility**

**Tech Stack:**
- **Framework:** React + TypeScript + Vite  
- **Styling:** TailwindCSS (preferred) or styled-components with design tokens  
- **State:** React Context or Zustand for lightweight session management  
- **Animations:** Framer Motion or CSS transitions  
- **Accessibility:** WAI-ARIA compliant, focus traps, keyboard support

---

## 🎨 Visual Identity

| Element | Spec |
|----------|------|
| **Bot Avatar** | Keka “K” label (SVG), circular badge, 28px |
| **User Avatar** | Circle with “YOU” text, 28px |
| **Color Palette** | `--brand: #1E90FF` (blue), `--accent: #10B981`, `--danger: #EF4444`, `--surface: #F8FAFC`, `--text: #0F172A`, `--muted: #64748B` |
| **Font** | Inter / Helvetica / system-ui |
| **Corner Radius** | 16–20px (rounded-2xl) |
| **Elevation** | Soft shadow: `0 10px 30px rgba(15,23,42,0.12)` |
| **Animations** | 150–250ms transitions, spring easing for open/close |

---

## 💬 Chat Widget Layout

**Position:**  
Pinned to bottom-right of screen.  
- Desktop: `bottom: 24px; right: 24px`  
- Mobile: `bottom: 16px; right: 16px`

**Structure:**

   // floating circular button
      // sliding panel (opens on click)
   // Keka label + close icon
  // all messages w/ timestamps & avatars
     // quick reply buttons


### ✳️ Open / Close Behavior
- Click launcher → panel fades/scales in (`opacity 0 → 1`, `scale 0.96 → 1`)
- Click close → reverse animation
- Panel state persisted in session storage (`open`, `closed`)
- Esc key closes the panel

---

## 🧩 Message Design

| Element | Style |
|----------|-------|
| **Bot Message** | Left aligned, white background, border hairline, rounded-xl |
| **User Message** | Right aligned, brand-blue background, white text |
| **Timestamps** | Shown below each message (`9:42 AM`), grouped within 2 minutes |
| **Avatar Placement** | Bot left / User right |
| **Accessibility** | `aria-live="polite"`, labeled avatars (“Keka Support”, “You”) |

### 💬 Example Block

[Keka Avatar] Hi there! How can I help today?
[Chips] Start Intake • Therapy & Rehab • Home Care • Speak with a Human
[12:41 PM]

---

## 🔘 Top-Level Chips (Main Menu)

Displayed on first open:

1. ✅ **Start Intake / Request Care**  
2. 🏥 **Therapy & Rehabilitation**  
3. 🩺 **Home Care & Caregiver Services**  
4. 👩‍⚕️ **Staffing & Agency Support**  
5. 💳 **Insurance & Billing Questions**  
6. 🛠️ **Home Safety & Equipment Help**  
7. 🏘️ **Community Programs & Marketplace**  
8. 🧍 **Speak with a Human**

> “Start Intake” must be the most prominent CTA — goal is to collect contact details in ≤2 steps.

---

## 🕑 Message Timestamps

- Format: `h:mm A` (local time)
- Tooltip: full datetime (e.g., “Mon Oct 27, 2025, 9:07 AM”)
- Group messages by author; only last in group shows timestamp if within 2 minutes
- Use subtle fade-in when appearing

---

## ⚙️ Components (for Claude Code)

| Component | Description |
|------------|--------------|
| `ChatLauncher.tsx` | Floating button (Keka logo), toggles panel open/close |
| `ChatPanel.tsx` | Main container; header, messages, chips |
| `ChatHeader.tsx` | Logo + "Keka Support" + close button |
| `MessageList.tsx` | Scrollable list of grouped messages |
| `MessageBubble.tsx` | Renders message w/ avatar + timestamp |
| `ChipTray.tsx` | Dynamic quick reply buttons |
| `IntakeForm.tsx` | Email/phone input + validation + submit |
| `TypingIndicator.tsx` | 3-dot bounce animation |
| `ErrorBubble.tsx` | Retry message with red border |
| `FooterDisclaimer.tsx` | “🚨 Not for emergencies — call 911…” |

---

## ⏳ States & Motion

| State | Behavior |
|--------|-----------|
| **Loading** | 3-dot bounce under last bot message |
| **Error** | Inline red bubble + retry chip |
| **Offline** | Banner: “You’re offline. Messages will send when reconnected.” |
| **Success (Intake)** | Checkmark animation (≤700ms) + thank-you message |

**Motion Specs:**
- Entry: slide-fade (10px offset, 200ms)
- Button press ripple: 100ms scale pulse
- Panel open: ease-out spring, 250ms
- Panel close: ease-in, 150ms

---

## ♿ Accessibility (WCAG 2.1 AA)

- `role="dialog"` for ChatPanel  
- `aria-modal="true"` with focus trap  
- Keyboard:
  - `Tab` navigates through chips
  - `Enter` or `Space` selects chip
  - `Esc` closes panel
- Contrast ratios ≥ 4.5:1
- Announce new messages politely via screen reader

---

## 🔒 Compliance & Safety Cues

- Always display:
  > “🚨 Not for emergencies — call 911. Don’t include medical details.”
- If user types potential PHI → auto-redirect to Speak with a Human flow
- Input validation:
  - Email: RFC 5322
  - Phone: E.164
- Disallow arbitrary text outside defined prompts

---

## 💾 Performance

- Virtualized message list for smooth scrolling
- Lazy-load avatars and animations
- Debounced reflow on new message append
- Avoid layout shift; animate transforms, not layout

---

## 📦 Example Folder Structure (Frontend)

frontend/
├── src/
│   ├── components/
│   │   ├── ChatLauncher.tsx
│   │   ├── ChatPanel.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── ChipTray.tsx
│   │   ├── IntakeForm.tsx
│   │   ├── TypingIndicator.tsx
│   │   ├── ErrorBubble.tsx
│   │   └── FooterDisclaimer.tsx
│   ├── styles/
│   │   ├── theme.css
│   │   ├── animations.css
│   │   └── variables.css
│   ├── lib/
│   │   ├── api.ts
│   │   ├── utils.ts
│   │   └── hooks.ts
│   └── main.tsx
├── vite.config.ts
└── tsconfig.json

---

## ✅ QA & Acceptance Criteria

| Category | Criteria |
|-----------|-----------|
| **UI Polish** | Smooth open/close; correct elevation; consistent avatars |
| **Timestamps** | Accurate per message; visible hover tooltip |
| **Responsiveness** | Mobile/desktop adaptive; no overflow |
| **Animations** | Smooth, accessible, 60fps |
| **Accessibility** | Keyboard & screen reader compliant |
| **Error Handling** | Retry and offline states work |
| **Compliance** | Disclaimer visible; no PHI entry allowed |
| **Performance** | Scrolls smoothly; no frame drops |

---

## 🧠 Implementation Mindset

The UI should:
- Feel **alive** and responsive — like Apple Messages meets Notion AI.  
- Inspire **trust** — calm, white-space-rich, professional.  
- Maintain **simplicity** — every pixel should serve the user.  
- Emphasize **conversion and care** — “Start Intake” and “Speak with a Human” are first-class citizens.

---

## 🎯 Summary

This agent should build a **beautiful, reliable, healthcare-friendly chatbot UI** that:
- Lives bottom-right,  
- Opens/closes fluidly,  
- Shows message timestamps and avatars,  
- Supports chips, errors, and loading gracefully,  
- Never feels robotic — always human, reassuring, and compliant.

**Design philosophy:**  
> “Fast, Frictionless, and Friendly — Care starts here.”

---