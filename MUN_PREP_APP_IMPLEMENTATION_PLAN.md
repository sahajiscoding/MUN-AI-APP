# MUN Prep App Implementation Plan

Date: 2026-08-24

## Important Secret Handling Note

API keys were pasted into the planning request. I will not save raw API keys in the repository, source code, frontend bundle, screenshots, documentation, or commit history. Treat the pasted keys as exposed and rotate them before production use.

The app should use environment variables only:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

OPENROUTER_API_KEY=
OPENROUTER_GLM_MODEL=
NVIDIA_API_KEY=
NVIDIA_MINIMAX_MODEL=minimaxai/minimax-m3
```

Only `NEXT_PUBLIC_*` Firebase client configuration belongs in browser code. Payment secrets, Firebase Admin credentials, OpenRouter keys, and NVIDIA keys must stay server-side.

## Product Goal

Build a paid MUN preparation web app where each user signs in with Firebase, buys access through Razorpay, and receives paid features only on the Firebase account that completed payment. The core experience should help delegates prepare for conferences using structured research workflows and AI assistance.

The app should feel like a serious delegate workspace, not a generic chatbot. It should guide the user from "I have an agenda and country" to "I have research notes, a position paper, speeches, POIs, and draft resolution material."

## Proposed App Stack

I will build the app as a modern TypeScript web application:

- Frontend: Next.js App Router, React, TypeScript.
- Styling: Tailwind CSS, with a restrained dashboard-style UI.
- Authentication: Firebase Authentication.
- Database: Firebase.
- Server authority: Next.js route handlers or server actions using Firebase Admin SDK.
- Payments: Razorpay Orders, Checkout, payment signature verification, and webhooks.
- AI providers:
  - OpenRouter for the configured GLM model.
  - NVIDIA API Catalog / NIM endpoint for `minimaxai/minimax-m3`.
- Deployment target: Vercel or Firebase Hosting with a server-capable backend. If deployed on Vercel, all secrets go into Vercel environment variables.

## Core User Flows

### 1. Account Creation And Login

The user can:

- Sign up with email/password and optionally Google sign-in.
- Verify email if required by the product policy.
- Create a delegate profile with name, school, grade, country preference, committee, agenda, experience level, and upcoming conference date.
- Access a dashboard showing locked or unlocked preparation tools.

Implementation details:

- Client uses Firebase Auth SDK.
- Server verifies Firebase ID tokens with Firebase Admin before every protected API action.
- Firestore stores user profile data under the authenticated UID.
- The UID becomes the permanent identity that payments and access are tied to.

### 2. Payment And Access Binding

The user can:

- Choose a paid plan.
- Start Razorpay Checkout.
- Complete payment.
- Return to the app with access unlocked only for the same Firebase account.

Implementation details:

- Client requests an order from `/api/payments/create-order`.
- Server verifies Firebase ID token.
- Server creates a Razorpay order with notes containing the Firebase `uid` and selected plan ID.
- Client opens Razorpay Checkout using only the public key and order details.
- After payment, client sends payment result to `/api/payments/verify`.
- Server verifies Razorpay payment signature.
- Server records the payment and updates the user's entitlement.
- Razorpay webhook endpoint also verifies webhook signatures and grants access idempotently for confirmed payment events.

The app must never grant access from a client-only success screen. Access comes from the backend after signature verification or webhook confirmation.

### 3. Paid Access Enforcement

The app will enforce access in three places:

- UI: show locked states for unpaid users.
- Server API: reject paid AI/tool calls unless the user's entitlement is active.
- Firestore rules: prevent users from reading or writing paid private data that is not theirs.

Access model:

- Entitlement is keyed by Firebase UID.
- Payment records store Razorpay order ID, payment ID, signature verification status, plan ID, amount, currency, and UID.
- A paid account cannot transfer access to another UID.
- Webhook processing is idempotent so duplicate Razorpay events do not duplicate entitlements.

## Main Features To Build

### Free Features

- Landing dashboard after login.
- Delegate profile setup.
- Basic conference checklist.
- Sample MUN glossary.
- Locked previews of paid tools.

### Paid Features

- Committee and agenda research workspace.
- Country policy profiler.
- Position paper builder.
- Opening speech generator and editor.
- Moderated caucus speech practice.
- POI and counterargument trainer.
- Draft resolution clause builder.
- Bloc strategy planner.
- Crisis update response assistant, if the user selects a crisis committee mode.
- Personal research notebook.
- Saved AI conversations and generated documents.
- Export to Markdown, PDF, or DOCX in a later phase.

## AI System Design

### Provider Routing

I will create one server-only AI gateway module inside the app:

- `lib/ai/openrouter.ts`
- `lib/ai/nvidia.ts`
- `lib/ai/router.ts`
- `app/api/ai/*`

The frontend will never call OpenRouter or NVIDIA directly.

Suggested initial routing:

- OpenRouter GLM model: general MUN research drafting, structured outputs, country policy summaries, position paper drafts.
- NVIDIA MiniMax M3: long-context analysis, creative debate prep, multimodal expansion later if image/video inputs become part of the product.

The provider router should support:

- Provider selection by tool type.
- Retry and timeout handling.
- Structured JSON outputs where needed.
- Logging token/cost estimates.
- Per-user rate limits.
- Abuse prevention.
- Graceful fallback messages when a provider fails.

### Prompt Architecture

Create reusable system prompts for:

- MUN research assistant.
- Position paper coach.
- Speech coach.
- POI trainer.
- Resolution clause drafter.
- Crisis committee strategist.

Each prompt should instruct the model to:

- Separate verified facts from suggested strategy.
- Ask clarifying questions when country, committee, agenda, or conference rules are missing.
- Avoid inventing citations.
- Keep outputs useful for a student delegate.
- Avoid producing harmful or discriminatory content.

### AI Data Safety

- Store user prompts and outputs only when needed for history.
- Let users delete saved AI generations.
- Do not send payment secrets, internal IDs, or Firebase tokens to AI providers.
- Add moderation or policy checks before high-risk content if the app expands into sensitive geopolitical topics.

## Firestore Data Model

Proposed collections:

```text
users/{uid}
  displayName
  email
  createdAt
  updatedAt
  role
  profileComplete

delegateProfiles/{uid}
  school
  grade
  experienceLevel
  country
  committee
  agenda
  conferenceDate
  goals

entitlements/{uid}
  status
  planId
  source
  startedAt
  expiresAt
  latestPaymentId
  latestOrderId
  updatedAt

paymentOrders/{orderId}
  uid
  planId
  amount
  currency
  razorpayOrderId
  status
  createdAt

payments/{paymentId}
  uid
  planId
  orderId
  razorpayOrderId
  razorpayPaymentId
  verified
  amount
  currency
  rawStatus
  createdAt

aiGenerations/{generationId}
  uid
  tool
  provider
  model
  inputSummary
  output
  tokenEstimate
  createdAt

researchNotes/{noteId}
  uid
  committee
  agenda
  country
  title
  body
  tags
  createdAt
  updatedAt
```

## Firestore Security Rules

Rules should enforce:

- Users can read and update only their own profile documents.
- Users cannot directly write entitlement documents.
- Payment records are server-write-only.
- AI generation history is readable only by the owner.
- Admin-only collections are denied to normal clients.

Entitlement changes must happen only through trusted server code after payment verification.

## Razorpay Implementation Details

### Server Endpoints

```text
POST /api/payments/create-order
POST /api/payments/verify
POST /api/webhooks/razorpay
GET  /api/me/entitlement
```

### Create Order

Inputs:

- Firebase ID token.
- Plan ID.

Server actions:

- Verify Firebase token.
- Validate plan exists.
- Create Razorpay order with amount and currency.
- Store local order record with UID and status `created`.
- Return order ID and public checkout data.

### Verify Payment

Inputs:

- Firebase ID token.
- Razorpay order ID.
- Razorpay payment ID.
- Razorpay signature.

Server actions:

- Verify Firebase token.
- Confirm the local order belongs to the same UID.
- Verify Razorpay signature.
- Mark payment verified.
- Grant entitlement.
- Return current entitlement.

### Webhook

Server actions:

- Verify Razorpay webhook signature.
- Parse event.
- Handle `order.paid` and relevant payment events.
- Look up local order by Razorpay order ID.
- Grant or update entitlement for the stored UID.
- Record the webhook event ID to prevent duplicate processing.

## AI API Implementation Details

### OpenRouter

Server endpoint:

```text
POST https://openrouter.ai/api/v1/chat/completions
```

Required server configuration:

- `OPENROUTER_API_KEY`
- `OPENROUTER_GLM_MODEL`

Implementation notes:

- Use server-side fetch.
- Add HTTP referer and title headers if configured for app attribution.
- Add timeout and provider error normalization.
- Keep model slug configurable so GLM model naming can be corrected without code changes.

### NVIDIA MiniMax M3

Server endpoint:

```text
POST https://integrate.api.nvidia.com/v1/chat/completions
```

Required server configuration:

- `NVIDIA_API_KEY`
- `NVIDIA_MINIMAX_MODEL=minimaxai/minimax-m3`

Implementation notes:

- Use OpenAI-compatible chat completion request shape.
- Support non-streaming first.
- Add streaming later with server-sent events once the normal path is stable.
- Keep `chat_template_kwargs.thinking_mode` configurable if we expose reasoning modes.

## UI Structure

Proposed routes:

```text
/
/login
/signup
/dashboard
/profile
/pricing
/checkout/success
/checkout/failure
/app/research
/app/country-profile
/app/position-paper
/app/speech-builder
/app/poi-trainer
/app/resolution-builder
/app/settings
```

Design direction:

- Dense, focused dashboard layout.
- Sidebar navigation for preparation tools.
- Clear locked/unlocked states.
- Tool-specific forms instead of one generic chat box.
- Saved output panel for research notes and drafts.
- Export controls where appropriate.
- Mobile layout with bottom navigation or collapsible sidebar.

## Premium UI Quality Bar: The $10K Checklist

This app should be designed and built to feel premium, intentional, and serious. The target is not a generic student project UI. The design should feel like a focused professional prep workspace that a delegate would trust before a major conference.

### 1. Point Of View, Not A Template

The app must commit to a specific design direction and execute it consistently. Possible directions include editorial research desk, diplomatic briefing room, modern institutional command center, or dark-luxury academic workspace.

The final design should not feel like a default SaaS template. It needs taste, restraint, and a clear personality.

### 2. Typography That Does Work

Typography should carry hierarchy and tone.

Requirements:

- Use a paired display and body typeface.
- Avoid default-feeling choices like Inter or Roboto unless there is a very deliberate reason.
- Use scale, weight, and spacing to make the dashboard easy to scan.
- Make generated drafts, research notes, and speeches comfortable to read for long sessions.

### 3. Restrained Color System

Use a controlled palette of three to five core colors.

Requirements:

- No rainbow palette.
- No random gradients.
- Use color consistently for states, hierarchy, and brand identity.
- Premium feeling should come from restraint, spacing, and materials, not decoration.

### 4. Hierarchy That Breathes

Every screen should make the next action obvious.

Requirements:

- Clear primary, secondary, and tertiary actions.
- Enough whitespace for complex MUN workflows to feel manageable.
- Strong contrast between navigation, workspace, and output areas.
- Avoid flat walls of content, especially on AI output pages.

### 5. Imagery With Intent

The visual system should use deliberate imagery, not generic stock.

Requirements:

- Avoid obvious Unsplash-style defaults.
- Use custom generated assets, curated diplomatic/editorial imagery, or minimal document-inspired visuals.
- Images should support the MUN preparation context: committees, placards, resolutions, speeches, negotiation, research, and conference atmosphere.
- Any generated imagery must match the selected art direction.

### 6. Motion That Whispers

Motion should feel polished and quiet.

Requirements:

- Use small transitions for navigation, panels, locked states, tool switching, and generation progress.
- Avoid flashy animation presets.
- Motion should clarify state changes, not distract from preparation work.
- AI streaming or loading states should feel confident and calm.

### 7. Mobile That Is Designed, Not Shrunk

The mobile app layout must be designed separately from desktop.

Requirements:

- Mobile navigation should be thumb-friendly.
- Tool forms should become step-based or stacked where needed.
- Long AI outputs should be readable without awkward horizontal scrolling.
- Pricing, checkout, login, dashboard, and core tools must be tested on phone sizes.
- No desktop sidebar simply crushed into a narrow screen.

### 8. The Invisible Expensive Stuff

The app should feel fast, accessible, and reliable.

Requirements:

- Target sub-2 second perceived load for key screens.
- Use semantic HTML.
- Meet WCAG AA contrast.
- Support keyboard navigation.
- Add real metadata, page titles, and social preview tags.
- Optimize bundle size and image loading.
- Prevent layout shift during loading and AI generation.
- Make errors clear, recoverable, and non-embarrassing.

## Development Milestones

### Milestone 1: Project Foundation

- Initialize Next.js TypeScript app.
- Add Tailwind and base UI components.
- Create environment variable template.
- Add `.gitignore` entries for secrets.
- Add app layout, dashboard shell, and basic routing.
- Define the premium design direction, typography pair, color system, spacing scale, and motion rules.

### Milestone 2: Firebase Authentication

- Create Firebase client initialization.
- Create Firebase Admin initialization.
- Add login and signup pages.
- Add auth state handling.
- Add protected route behavior.
- Add delegate profile setup.

### Milestone 3: Paid Access System

- Define plans.
- Build pricing page.
- Add Razorpay order creation endpoint.
- Add Checkout integration.
- Add payment verification endpoint.
- Add webhook endpoint.
- Create entitlement checks.
- Add locked states for paid tools.

### Milestone 4: AI Gateway

- Add server-side provider clients for OpenRouter and NVIDIA.
- Add model router.
- Add paid-user checks before AI calls.
- Build first AI tool: MUN research assistant.
- Add structured output validation.
- Add generation history.

### Milestone 5: MUN Tool Suite

- Position paper builder.
- Opening speech builder.
- POI trainer.
- Country policy profile.
- Resolution clause builder.
- Research notebook.
- Exportable drafts.

### Milestone 6: Security, Testing, And Launch Readiness

- Firestore security rules.
- API route tests.
- Payment webhook idempotency tests.
- AI provider failure tests.
- Rate limiting.
- Error states.
- Loading states.
- Accessibility pass for contrast, keyboard navigation, labels, and semantic structure.
- Performance pass for load time, bundle size, layout shift, and image optimization.
- Production environment setup.
- Deployment verification.

## Testing Plan

### Authentication Tests

- User can sign up.
- User can log in.
- User can log out.
- Protected pages redirect unauthenticated users.
- Server rejects invalid Firebase tokens.

### Payment Tests

- Logged-in user can create a Razorpay order.
- Anonymous user cannot create an order.
- Payment verification rejects invalid signatures.
- Payment verification rejects orders belonging to a different UID.
- Successful payment grants entitlement.
- Duplicate webhook does not duplicate access or corrupt state.
- Failed payment does not grant entitlement.

### AI Tests

- Unpaid user cannot call paid AI tools.
- Paid user can call paid AI tools.
- Provider errors return clean user-facing errors.
- API keys never appear in client bundles.
- Saved generations are tied to the correct UID.

### UI Tests

- Login/signup works on desktop and mobile.
- Dashboard shows correct locked/unlocked state.
- Pricing page launches Checkout.
- Paid tools remain usable on mobile.
- Long generated content does not break layout.
- Typography hierarchy remains clear across desktop and mobile.
- Motion does not block keyboard or screen-reader workflows.
- Core pages meet WCAG AA contrast.
- Key screens feel intentionally designed on mobile, not merely compressed.

## Deployment Plan

1. Create Firebase project.
2. Enable Authentication providers.
3. Create Firestore database.
4. Configure Firestore indexes and security rules.
5. Create Razorpay account and test keys.
6. Configure Razorpay webhook URL.
7. Add OpenRouter and NVIDIA keys to server environment.
8. Deploy preview build.
9. Run test payment.
10. Confirm entitlement appears in Firestore.
11. Run AI tool smoke tests.
12. Switch to live Razorpay keys only after test mode is fully verified.

## Risks And Mitigations

### Risk: API Keys Leak

Mitigation:

- Rotate keys that were pasted into chat.
- Store keys only in environment variables.
- Never put server secrets in `NEXT_PUBLIC_*`.
- Add automated checks before deployment if possible.

### Risk: Users Share Paid Access

Mitigation:

- Tie entitlement to Firebase UID.
- Verify UID server-side for every paid operation.
- Optionally add device/session monitoring later.

### Risk: Client-Side Payment Spoofing

Mitigation:

- Verify Razorpay signatures on the server.
- Use webhooks as the authoritative backup.
- Never unlock from client callback alone.

### Risk: AI Hallucinated Research

Mitigation:

- Make prompts distinguish facts, assumptions, and strategy.
- Add citations only through a future retrieval/search layer.
- Add "needs verification" labels where sources are absent.

### Risk: Provider Downtime

Mitigation:

- Normalize provider errors.
- Add retries for transient failures.
- Allow fallback between providers where appropriate.

## First Implementation Pass

If starting from the current empty folder, I will implement in this order:

1. Scaffold the Next.js TypeScript app.
2. Add environment templates and secret-safe configuration.
3. Build Firebase login/signup and protected dashboard.
4. Add Firestore user/profile records.
5. Add plan definitions and Razorpay order creation.
6. Add payment verification and entitlement records.
7. Add Razorpay webhook handling.
8. Build locked paid tool shell.
9. Add server-side OpenRouter and NVIDIA provider clients.
10. Build the first complete paid AI workflow: MUN research assistant.
11. Add position paper and speech builder flows.
12. Add tests and run local verification.

## Source References Checked

- Firebase Authentication docs: https://firebase.google.com/docs/auth
- Firebase web auth start docs: https://firebase.google.com/docs/auth/web/start
- Razorpay webhooks docs: https://razorpay.com/docs/webhooks/
- Razorpay callback URL clarification: https://razorpay.com/docs/payments/payment-gateway/callback-url/
- OpenRouter quickstart: https://openrouter.ai/docs/quickstart
- NVIDIA MiniMax M3 API reference: https://docs.api.nvidia.com/nim/reference/minimaxai-minimax-m3
- NVIDIA LLM API reference: https://docs.api.nvidia.com/nim/reference/llm-apis
