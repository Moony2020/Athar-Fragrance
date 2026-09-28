نبدأ بخطة ATHAR مستقلة ونظيفة من الصفر.

والـHero عندك كما قلت: صورة ثابتة responsive، بدون scroll animation وبدون cinematic sequence. ممكن يكون فيه فقط micro-interactions خفيفة جدًا مثل hover أو fade-in عند أول تحميل، لكن لا نعمل frame sequence ولا GSAP scroll storytelling.

التقنية التي أنصح بها لـATHAR

أفضل Stack لهذا المشروع:

Next.js 16.3.x
React 19
TypeScript
Tailwind CSS
CSS Modules
MongoDB Atlas
Auth.js
Stripe Payment Element
Direct PayPal Orders API
Resend
Cloudinary أو storage مناسب للصور
Zod

ولا أنصح بـNode.js + Express منفصل هنا؛ Next.js يكفي للـfrontend والـbackend في نفس المشروع:

Next.js
├── Frontend
├── Server Components
├── Route Handlers
├── Server Actions
├── Authentication
├── Checkout
├── Webhooks
├── Admin
└── API boundaries

هذا أبسط، أنظف، وأسهل في deployment والصيانة.

وبالنسبة للـCSS، أتفق معك 100%. ممنوع ملف CSS ضخم 7,000 أو 10,000 سطر.

نستخدم مثلًا:

src/styles/
  globals.css
  tokens.css
  typography.css
  animations.css

src/components/home/
  Hero/
    Hero.tsx
    Hero.module.css

  Collections/
    Collections.tsx
    Collections.module.css

  Bestsellers/
    Bestsellers.tsx
    Bestsellers.module.css

  Story/
    Story.tsx
    Story.module.css

  FragranceGuide/
    FragranceGuide.tsx
    FragranceGuide.module.css

Tailwind للأشياء البسيطة:

spacing
flex
grid
responsive
visibility
basic typography

وCSS Modules للتصميم الخاص:

organic shapes
custom masks
complex image positioning
hero composition
editorial layouts
special hover effects

بهذا ما يتحول المشروع إلى فوضى.

ATHAR — الخطة التي أقترحها

Phaseالمحتوى



0 — Repository & Project Foundation

إنشاء المشروع، Next/React/TypeScript، lint، env، aliases، folder architecture، docs

1 — Design System & Shared UI

الألوان، typography، spacing، buttons، cards، icons، responsive rules، header/footer

2 — Homepage

Hero الثابت، Shop by Collection، Bestselling Fragrances، Our Story، Fragrance Guide

3 — Catalog & Product Discovery

Shop، Women/Men/Unisex، Brands، Collections، Search، Filters، Sorting

4 — Product Detail

Gallery، sizes، price، stock، notes، ingredients، related products، wishlist، add to cart

5 — Cart & Wishlist

Guest cart، account cart، drawer، full cart، quantity، totals، wishlist

6 — Authentication & Account

Register، verify email، login، logout، recovery، profile، addresses، order history

7 — Checkout Foundation

contact، address، shipping، totals، VAT، discounts، inventory reservation

8 — Payments

Stripe Card + Direct PayPal، paymentAttempt، provider IDs، webhooks، idempotency

9 — Orders & Transactional Email

canonical Order، Order number، customer email، admin email، receipt/invoice document

10 — Admin Platform

Dashboard، Products، Images، Stock، Orders، Customers، Discounts، Brands، Collections

11 — Content Pages

About، Journal، Brands، Contact، FAQ، legal/privacy/cookies

12 — QA & Security

security، responsive، accessibility، SEO، performance، inventory concurrency

13 — Production

production DB، Stripe Live، PayPal Live، email domain، deployment، backups، E2E

هذا المشروع لا يحتاج Phase Cinematic مثل AURA.

Phase 0 — البداية الصحيحة

أول شيء Codex لا يبدأ يصمم الـHero مباشرة.

ينشئ:

/docs

ونعمل Documentation من البداية:

docs/
├── MASTER-PLAN.md
├── PROJECT-STATUS.md
├── ARCHITECTURE.md
├── DESIGN-SYSTEM.md
├── DATABASE.md
├── API.md
├── SECURITY.md
├── TESTING.md
├── CHANGELOG.md
│
├── phases/
│   ├── PHASE-00-FOUNDATION.md
│   ├── PHASE-01-DESIGN-SYSTEM.md
│   ├── PHASE-02-HOMEPAGE.md
│   └── ...
│
└── decisions/
    ├── ADR-001-APPLICATION-ARCHITECTURE.md
    ├── ADR-002-DATABASE.md
    ├── ADR-003-AUTH.md
    └── ...

والقاعدة:

لا توجد مرحلة:
"خلصتها"

إلا لو:
implementation + tests + docs + verification
كلها تمت.

وكل Stage تعمل:

Goal Contract
↓
Owner Decisions إن وجدت
↓
Implementation Plan / Ledger
↓
Implementation
↓
Tests
↓
Documentation
↓
Sign-off
↓
STOP

نفس الانضباط الذي نستخدمه مع AURA، لكن بدون نسخ تفاصيل AURA.

Phase 1 — Design System

قبل الصفحة الرئيسية نفسها، نثبت هوية ATHAR.

من الصورة:

Background
warm ivory / cream

Primary text
near-black

Accent
warm beige / champagne

Supporting colors
sand
stone
warm brown
soft blush
muted gold

Typography تكون:

Editorial Serif
للـ:
Hero
Section headings
Product storytelling

Clean Sans Serif
للـ:
Navigation
Prices
Buttons
Forms
Filters
Checkout
Admin

ونبني Tokens بدل أرقام متناثرة:

--color-bg
--color-surface
--color-text
--color-muted
--color-accent
--color-border

--space-xs
--space-sm
--space-md
--space-lg
--space-xl

--radius-organic
--shadow-soft

Phase 2 — Homepage

هذه الصفحة في الصورة تنقسم منطقيًا إلى خمسة Sections مستقلة.

Hero

بالضبط كما طلبت:

Static hero
No scroll animation
No video sequence
No frame animation

لكن responsive composition حقيقية.

Desktop:

ATHAR logo
navigation

left:
eyebrow
A Story
In Every Drop
description
CTA

center:
perfume hero image

right:
Natural Ingredients
Long Lasting
A Signature For You

وعلى mobile لا نحاول ضغط نفس الـdesktop composition. نعيد ترتيبها بشكل محترم:

image
heading
description
CTA
benefits

ولا نعتمد على absolute positioning لكل شيء بطريقة تتكسر على الهاتف.

Shop by Collection

نستخدم Organic cards مثل الصورة، وليس كل شيء rectangles.

For Her
For Him
Unisex
New Arrivals

يمكن استخدام:

border-radius:
45% 55% 52% 48% / 40% 42% 58% 60%;

أو masks/clip-path عند الحاجة.

لكن لا نكرر نفس blob shape أربع مرات حرفيًا.

Bestselling Fragrances

Horizontal product presentation:

Product image
Brand
Name
Price
Wishlist
optional badge

مثلاً:

Most Loved
New
Exclusive

لكن لا نخترع Bestselling أو Most Loved data. هذه تكون merchandising field حقيقية في database/admin.

Our Story

نفس الـeditorial feeling الموجود بالصورة:

large asymmetric photography
quote area
story text
brand values
CTA

Fragrance Guide

هذه تكون section جميلة جدًا ومفيدة:

Floral
Woody
Fresh
Oriental

وفي المستقبل نربطها بفلاتر المنتجات.

مثلاً:

/collections/floral
/fragrances?family=woody

وليس مجرد صور لا تعمل.

Product System

من البداية Product لا يكون hardcoded داخل JSX.

MongoDB:

Product
├── name
├── slug
├── brandId
├── gender/audience
├── description
├── shortDescription
├── fragranceFamily
├── topNotes
├── heartNotes
├── baseNotes
├── ingredients
├── images
├── variants
├── status
├── featured
├── bestseller
└── launchAt

Variant:

variantId
sku
sizeMl
price
compareAtPrice
stock
isActive

كل الأسعار:

integer minor units

مثلاً:

1299 SEK
→ 129900 öre

وليس floating-point.

Brands

بما أن التصميم فيه:

Dior
Versace
YSL
Lancôme
Armani

نعمل Brand Domain حقيقي:

Brand
├── name
├── slug
├── description
├── logo
├── heroImage
└── status

فتصبح:

/brands
/brands/dior
/brands/versace

وليس مجرد filter نصي.

Payment

وهنا نقدر نستفيد من المعرفة التي اكتسبناها من AURA، لكن نطبقها صح من البداية.

ATHAR لا نريد أن يصل لنفس gap الذي اكتشفناه اليوم.

من البداية:

paymentAttempt
│
├── id
├── provider
├── amount
├── currency
├── cartId
├── reservationId
│
├── providerPaymentId
├── providerPaymentStatus
│
└── timestamps

Stripe:

ATHAR paymentAttempt
        ↕
Stripe PaymentIntent
pi_...

PayPal:

ATHAR paymentAttempt
        ↕
PayPal Order
        ↕
PayPal Capture

وبذلك الـwebhooks من أول تصميمها تعرف بالضبط ما الذي تربطه.

الدفع الفعلي:

CARD
→ Stripe Payment Element

PAYPAL
→ Direct PayPal

ولا نخلط PayPal داخل Stripe.

الـOrder

وهذه نقطة مهمة جدًا.

لا نجعل:

Stripe PaymentIntent ID

هو رقم طلب العميل.

ATHAR يولد Order Number خاص به، مثل:

ATH-2026-000001
ATH-2026-000002

ثم:

Customer
↓
Order Confirmation

Customer Email
↓
ATH-2026-000001

Admin Email
↓
New Order ATH-2026-000001

My Account
↓
ATH-2026-000001

Admin Dashboard
↓
ATH-2026-000001

Stripe/PayPal IDs تبقى references داخلية للدفع.

الـEmail

هذه المرة نحطها بالخطة من البداية.

بعد trusted payment + canonical Order:

Customer:
Order confirmation email
Order details
Shipping address
Items
Subtotal
Shipping
VAT
Total
Payment method
Order number
Receipt/invoice document where applicable

Admin:
New Order email
Customer
Items
Total
Payment method
Order number
Admin order link

ليس:

browser redirected to success
→ send email

بل:

trusted payment
→ canonical Order
→ idempotent email

Admin

ATHAR يحتاج Admin محترم، ليس CRUD بدائي.

Dashboard

Products
Brands
Collections
Inventory
Orders
Customers
Discounts
Journal
Homepage merchandising
Site settings

ومن Admin تستطيع مثلًا تحدد:

Featured
Bestseller
New Arrival
Homepage order
Collection membership
Stock
Price

وبذلك الـHomepage نفسها تصبح dynamic لاحقًا.

الصور

لا نحط كل الصور داخل public للأبد إذا الموقع سيكبر.

أوصي:

Cloudinary

أو storage مناسب.

MongoDB يخزن metadata فقط:

url
publicId
alt
width
height
position
type

ولا نخزن الصور نفسها داخل MongoDB.

أهم فرق عن AURA

ATHAR أبسط بكثير من ناحية الـexperience:

AURA
cinematic / portals / frame sequences / GSAP worlds

ATHAR
luxury editorial ecommerce
static photography
subtle interactions
strong typography
organic layouts

وهذا شيء جيد؛ سيسمح لنا نصرف الوقت على:

catalog
checkout
payments
orders
admin
SEO
performance
mobile

بدل تعقيد animation runtime.

أول Prompt أعطيه لـCodex

لو المشروع جديد أو الموجود حاليًا مجرد prototype، لا تعطه Prompt يبني الموقع كله مرة واحدة.

أول Prompt فقط يعمل Audit + Documentation + Master Plan.

استخدم هذا:

PROJECT: ATHAR — Premium Fragrances

You are beginning a new production-quality luxury fragrance ecommerce project.

Do NOT start broad feature implementation yet.

Your first responsibility is to inspect the actual repository and establish the
project's verified technical and documentation baseline.

==================================================
1. PRODUCT VISION
==================================================

ATHAR is a premium fragrance ecommerce experience with an editorial luxury
visual identity.

The supplied homepage reference defines the intended visual direction:

- warm ivory / cream palette
- strong editorial serif typography
- restrained sans-serif UI typography
- premium fragrance photography
- organic/asymmetric image/card silhouettes
- generous spacing
- minimal luxury navigation
- editorial storytelling
- no generic SaaS/Bootstrap/Shopify appearance

The homepage includes conceptually:

- Header/navigation
- Static Hero
- Shop by Collection
- Bestselling Fragrances
- Our Story
- Fragrance Guide
- Footer

IMPORTANT:

The Hero is STATIC photography.

Do NOT implement:

- scroll-driven hero animation
- video frame sequences
- cinematic portal runtime
- canvas animation
- GSAP scroll storytelling

Subtle entrance/hover transitions may be evaluated later, but no cinematic
scroll system is part of ATHAR.

==================================================
2. PREFERRED APPLICATION STACK
==================================================

Inspect the repository first.

If no incompatible established architecture exists, prefer:

- Next.js 16.3.x compatible current stable release
- React 19
- TypeScript
- Next.js App Router
- MongoDB Atlas
- Tailwind CSS for utility/layout work
- CSS Modules for complex editorial component styling
- Zod validation
- Auth.js for customer authentication
- Stripe Payment Element for credit/debit cards
- Direct PayPal Orders API for PayPal
- server-authoritative payment webhooks
- Resend or another later owner-approved transactional email provider
- Cloudinary or an owner-approved media provider for production product imagery

Do NOT introduce a separate Express backend unless repository inspection proves
a real architectural requirement.

Do NOT use JavaScript where TypeScript is already the accepted application
language without a specific reason.

==================================================
3. CSS / STYLING ARCHITECTURE
==================================================

Do NOT create one giant stylesheet.

Never allow globals.css or another file to grow into thousands of lines of
component-specific CSS.

Establish a modular styling strategy such as:

src/styles/
  globals.css
  tokens.css
  typography.css
  animations.css

and component-local styles such as:

src/components/home/Hero/Hero.module.css
src/components/home/Collections/Collections.module.css
src/components/home/Bestsellers/Bestsellers.module.css
src/components/home/Story/Story.module.css
src/components/home/FragranceGuide/FragranceGuide.module.css

Tailwind should handle appropriate utilities/layout/responsive composition.

CSS Modules should own complex bespoke editorial shapes, masks, positioning and
component-specific effects.

Do not duplicate design tokens throughout files.

==================================================
4. DOCUMENTATION IS MANDATORY
==================================================

Create or reconcile:

docs/
  MASTER-PLAN.md
  PROJECT-STATUS.md
  ARCHITECTURE.md
  DESIGN-SYSTEM.md
  DATABASE.md
  API.md
  SECURITY.md
  TESTING.md
  CHANGELOG.md

docs/phases/

docs/decisions/

Every meaningful Phase and Stage must be documented.

No stage may be marked COMPLETE solely because code exists.

Completion requires:

implementation
+ tests
+ documentation
+ verification
+ explicit sign-off

==================================================
5. GOVERNANCE MODEL
==================================================

Use:

Phase
→ Stage
→ Goal Contract
→ genuine Owner Decisions if required
→ Phase Ledger / implementation plan
→ implementation
→ tests/evidence
→ documentation
→ sign-off
→ next stage

Stop at owner decision boundaries.

Never silently jump ahead.

Never mark unavailable external evidence as PASS.

Use:

IMPLEMENTED — NOT YET VERIFIED

where external evidence genuinely cannot yet be executed.

==================================================
6. DO NOT COPY AURA-SPECIFIC ARCHITECTURE
==================================================

ATHAR is an independent project.

Do NOT copy references such as:

- AURA
- cinematic worlds
- portal runtime
- six cinematic products
- fragrance world ACQUIRE flows
- AURA-specific route contracts
- AURA completion statuses

You may reuse sound engineering principles, but ATHAR documentation and domain
contracts must be independently derived from the actual ATHAR repository and
product requirements.

==================================================
7. TARGET MASTER PLAN
==================================================

The Master Plan should evaluate and formalize this approximate sequence:

Phase 0 — Repository Audit & Baseline
Phase 1 — Architecture, Design System & Domain Foundation
Phase 2 — Homepage
Phase 3 — Catalog, Brands, Collections & Product Discovery
Phase 4 — Product Detail & Merchandising
Phase 5 — Cart & Wishlist
Phase 6 — Authentication & Customer Account
Phase 7 — Checkout Foundation
Phase 8 — Stripe + Direct PayPal Payments and Webhooks
Phase 9 — Canonical Orders & Transactional Email
Phase 10 — Admin Platform
Phase 11 — Content / Journal / Legal / Customer Experience
Phase 12 — Security, Performance, Accessibility & SEO
Phase 13 — Production Readiness

Do not blindly create this exact structure if repository inspection reveals a
strong reason to adjust it.

Any adjustment must be documented and justified.

==================================================
8. PAYMENT ARCHITECTURE REQUIREMENT
==================================================

Record now as a future invariant only.

Functional payment providers:

CARD
→ Stripe Payment Element

PAYPAL
→ direct PayPal integration

Do not combine direct PayPal into Stripe.

Future paymentAttempt architecture must durably correlate provider payments.

For Stripe:

ATHAR paymentAttempt
↔
Stripe PaymentIntent ID

For PayPal:

ATHAR paymentAttempt
↔
PayPal Order / Capture

The future payment model must not repeat the mistake of creating a provider
payment without durably linking its provider ID to the canonical local
paymentAttempt before customer payment progression.

Browser redirects are never payment proof.

Signed/verified webhooks and trusted provider state are authoritative.

No raw card data may enter ATHAR persistence.

==================================================
9. FUTURE ORDER ARCHITECTURE
==================================================

Record as future requirements only.

A successful trusted payment later produces a canonical ATHAR Order.

ATHAR owns its own customer-facing order number, for example:

ATH-YYYY-XXXXXX

Provider IDs are payment references, not customer Order numbers.

Future order finalization must support:

- canonical immutable Order snapshot
- customer order confirmation email
- admin New Order email
- receipt/invoice-type document according to later approved legal/accounting
  requirements
- customer Account Order History
- later Admin Order Management

Do not implement these in Phase 0.

==================================================
10. DATABASE PRINCIPLES
==================================================

Future product/catalog data must be canonical and database-backed.

Do not hard-code production catalog products into JSX.

Product architecture should later evaluate:

- Product
- ProductVariant
- ProductMedia
- Brand
- Collection
- fragrance families/notes
- Inventory
- User
- Address
- Cart
- Wishlist
- paymentAttempt
- provider-event inbox
- Order
- Discount

Money must use integer minor units.

Do not store image binary data directly in MongoDB.

==================================================
11. HOMEPAGE CONTENT PRINCIPLE
==================================================

The supplied visual reference is a design direction, not permission to invent
commercial facts.

Do not claim:

- bestseller
- most loved
- new arrival
- discounts
- ratings
- stock
- brand authorization

without canonical owner-approved data.

Real brand/product names visible in reference imagery must not automatically
become canonical production catalog data.

==================================================
12. PHASE 0 TASK
==================================================

For this run ONLY:

1. Audit the actual repository.
2. Identify existing stack/version/package manager.
3. Map routes/components/styles/assets.
4. Identify current responsive/design implementation.
5. Identify technical debt and risks.
6. Determine whether this is a prototype or established application.
7. Create/reconcile the documentation architecture.
8. Create the ATHAR Master Plan.
9. Create Project Status.
10. Create Phase 0 audit documentation.
11. Run safe baseline checks available in the repository.

Do NOT begin Phase 1 feature implementation.

==================================================
13. REPORT
==================================================

Report:

- verified current stack
- repository structure
- current homepage/component state
- styling architecture
- database/auth/payment state
- risks/debt
- files created/modified
- baseline TypeScript/lint/build/test/audit results
- proposed final Phase sequence
- genuine Owner Decisions required before Phase 1

Then:

ATLAS_STOP

Await owner review.

Do NOT begin Phase 1 automatically.

==================================================
14. ATHAR — PHASE 6 / STAGE 6.1 CONTRACT
==================================================

Baseline: `1cc405bf77e44777cae20b1e2998bfbdf5366bcd`

Phase 6: Authentication and Customer Account

Stage 6.1: Customer Identity & Account Foundation

Goal contract:

- Establish the canonical customer User identity boundary and account-ready
  ownership contract without starting later authentication runtime stages.
- Keep public DTOs free of credentials, provider tokens, and internal Mongo IDs.
- Preserve guest Cart/Wishlist behavior; guest-to-account merge remains later.

Owner-approved authentication decisions:

- Email + Password only.
- Authentication framework: Auth.js.
- Future Auth method: Credentials / email-password.
- OAuth/social login: NOT USED.
- Clerk: NOT USED.
- Transactional email provider: Brevo.
- Email verification: NOT REQUIRED / NOT IMPLEMENTED.
- Password reset: REQUIRED LATER.
- Future Order confirmation emails: REQUIRED THROUGH BREVO.

Customer/User domain requirements:

- Use a public opaque User ID; never expose Mongo `_id` or credential fields.
- Normalize email deterministically and enforce a unique normalized-email rule.
- Define strict User repository, index, and parser boundaries that reject
  unexpected persisted fields and keep storage-only fields private.
- Support authenticated ownership through the existing `CommerceOwner` user
  identity contract without changing guest semantics.

Guest → Account merge: CONTRACT ONLY / NOT IMPLEMENTED.

Stage 6.1 out of scope:

- Auth.js runtime/session wiring and registration or sign-in.
- OAuth/social providers, Clerk, required email verification, password reset
  execution, profile UI, checkout, payments, orders, inventory, and Stage 6.2+.

Completion contract:

- Identity/domain contract, persistence boundary, parser/index rules, tests,
  and repository documentation are internally consistent and verified.
- Stage 6.2 is NOT STARTED.

==================================================
15. ATHAR — PHASE 6 / STAGE 6.2 CONTRACT
==================================================

Baseline: `2a2706429d0ad5231edf903c4d9aff8fdec85df5`

Stage 6.2: Auth.js Credentials Runtime + Email/Password Registration & Sign-In

Goal contract:

- Implement real Auth.js Credentials runtime with email/password registration,
  sign-in, sign-out, and JWT-backed sessions.
- Use Argon2id for password hashing and keep credentials in a separate
  persistence collection from the canonical User domain.
- Expose only the public opaque `userId` in session state; never expose Mongo
  `_id` or `passwordHash`.
- Reject disabled users and return generic duplicate-email errors.

Allowed authentication: Auth.js Credentials only; email + password only.

Explicitly excluded: OAuth, Google, Apple, Clerk, magic links, email
verification, password reset, Brevo sending, guest-to-account merge,
account/profile UI, Stage 6.3+, and checkout/payment/order work.

Persistence boundary:

- Canonical User records remain in `users`.
- Password hashes and disabled state live in `user_credentials`.
- Identity indexes are explicit and unique for User email, User public ID, and
  credential user ownership.

هذا هو الـPrompt الذي أبدأ به المشروع.

وبعد أن Codex يرجع لنا Audit حقيقي، أنا أراجع التقرير معك، وبعدها نثبت Stack نهائيًا ونبدأ Phase 1. بهذه الطريقة ما نكرر خطأ أن نبني نصف المشروع ثم نكتشف لاحقًا أن architecture ناقصة.

==================================================
ATHAR — PHASE 6 / STAGE 6.3 CONTRACT
==================================================

Baseline: `3e7840d4ae9d7f8b747f2672c735efeba83be7b4`

Stage 6.3: Customer Account Shell & Profile

Goal contract:

- Provide a protected `/account` shell backed by the Auth.js server session.
- Read and update canonical User profile data through the repository boundary.
- Allow only trimmed `displayName` updates; email remains read-only.
- Derive ownership exclusively from the server session public `userId`.
- Never expose Mongo `_id`, credentials, or `passwordHash`.

Out of scope: email change, password change/reset, addresses, orders, cart or
wishlist merge, guest-to-account reconciliation, Auth.js provider changes, and
Stage 6.4+.

Closure evidence:

- `STAGE 6.3 COMPLETE — CUSTOMER ACCOUNT SHELL & PROFILE`
- `STAGE-6.3-ONLY PRODUCTION BUILD — PASSED`
- The current working-tree build remains blocked only by the preserved Owner
  Header/Wishlist change at `/_not-found`; this is outside Stage 6.3.
- Stage 6.4: COMPLETE LOCALLY; Stage 6.5 NOT STARTED.

==================================================
ATHAR — PHASE 6 / STAGE 6.4 CONTRACT
==================================================

Baseline: `2851f06308c82c6eeeb25f12154f92fd82a7ac00`

Stage 6.4: Guest-to-Account Commerce Reconciliation

Goal contract:

- Merge guest Cart and Wishlist into the authenticated public `userId` owner
  after registration or Credentials sign-in.
- Cart identity is `productSlug + variantId`; quantities are additive and cap
  at 12 while canonical prices and availability are re-resolved server-side.
- Wishlist is a deduplicated product-slug union with stale-item reconciliation.
- Merge is server-only, CAS-safe, retry-safe, idempotent, and clears guest
  state only after complete success; failures preserve guest data.

Out of scope: orders, addresses, password reset, Brevo, Checkout, Payments,
and Stage 6.5+.

Closure evidence: pure reconciliation, dedicated Mongo `athar_stage55_test`,
concurrency/retry idempotency, authenticated `/cart` and `/wishlist` owner
resolution, and existing-account Browser E2E (merge, sign-out/sign-in repeat,
no duplication) passed. Clean baseline and Stage-6.4-only production builds
passed. The current-tree build remains blocked by the preserved Owner
Header/Wishlist dynamic-cookie change outside Stage 6.4.

==================================================
ATHAR — PHASE 6 / STAGE 6.5 CONTRACT
==================================================

Baseline: `87b9993d9d0a6bb76d6eb88b3909f90591750ff0`

Stage 6.5: Account Security & Password Recovery

Goal contract:

- Add Forgot Password and Reset Password UI/routes using Auth.js, canonical
  User identity, and separate `user_credentials` persistence.
- Return account-independent forgot responses; only active users with active
  credentials are eligible to receive a reset message.
- Generate cryptographically strong one-time tokens, persist only SHA-256
  token hashes, expire them after 30 minutes, replace/invalidate earlier
  tokens, and define explicit idempotent unique/TTL index setup.
- Deliver branded transactional email with server-only Brevo using
  `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, and
  `NEXT_PUBLIC_SITE_URL`. No mock provider is selected in production.
- Enforce the existing 15–128 password policy and Stage 6.2 Argon2id settings.
  Consume the one-time token, update credentials, invalidate sibling tokens,
  and increment a private security version atomically in Mongo transactions.
- Auth.js invalidates previous JWT sessions after reset without exposing
  securityVersion, Mongo `_id`, reset tokens, or password hashes publicly.

Excluded: email verification, OAuth/social/Clerk, signed-in password change,
profile changes, support override, Stage 6.6, orders, Checkout, payments, and
unrelated Owner/local changes.

Verification contract: parser/domain tests; dedicated Mongo CRUD/index/expiry,
one-time/concurrent consumption, password and session revocation tests; browser
forgot/reset flow; prior-stage regressions; TypeScript, ESLint, production
build attribution, and git diff check. Only `athar_stage55_test` may receive
test writes. Live Brevo delivery is unverified unless approved test-mailbox
delivery is actually observed. No commit or push; Stage 6.6 stays NOT STARTED.

Current verification evidence (2026-09-24): `.env.local` loads the expected
dedicated test DB and Mongo mode without exposing credentials. Earlier TLS
failures followed a switch from mobile hotspot to hotel Wi-Fi while the active
network IP was not on Atlas IP Access List. The owner subsequently reported two
consecutive `MONGO_PING: PASS` results on the same hotel Wi-Fi. The live Stage
6.5 focused auth/Mongo tests passed 8/8, including indexes, strict parsing,
hash-only token persistence, replacement/expiry, concurrent single-use
consumption, credential update, and `securityVersion` increment. The Browser
E2E passed the protected test-mail flow through password replacement, old
password rejection, new password acceptance, prior-session invalidation, and
reused-token rejection; unknown/disabled accounts remained generic and sent no
mail. A confirmed forgot-route input-shape defect was fixed and has a focused
regression. Post-run cleanup found zero disposable users, credentials, or reset
tokens in `athar_stage55_test`. Prior-stage domain/auth regression passed 36
tests with one live Mongo case run separately; Stage 6.1, 6.2, and 6.4 live
Mongo regressions passed individually. Full TypeScript and ESLint passed (one
existing `SignInForm.tsx` warning). After the route fix, clean baseline and
baseline plus Stage-6.5-only production builds passed. Current-tree build
remains attributed to preserved Owner Header/Wishlist request-time data outside
Stage 6.5. Brevo live delivery remains NOT YET VERIFIED. Stage 6.5 is COMPLETE
LOCALLY; Stage 6.6 is NOT STARTED as of this Stage 6.5 closure record.

==================================================
ATHAR — PHASE 6 / STAGE 6.6 INTEGRATION STATUS
==================================================

Official Stage 6.6 baseline: `34fc73b0f69a1c04670840bfbe3c782e8a7f6c0e`.

Current state: `STAGE 6.6 COMPLETE — PHASE 6 INTEGRATION & CLOSURE`;
`PHASE 6 COMPLETE LOCALLY — AUTHENTICATION & CUSTOMER ACCOUNT`.

Final verification resumed on 2026-09-26 after the network/session interruption.
The focused Phase 6/Phase 5 regression bundle passed 40/40, including live
Mongo verification against only `athar_stage55_test`. Full Browser E2E passed
8/8 across registration/sign-in/out, profile read/update, new and existing-user
guest Cart/Wishlist merge, authenticated owner resolution and mutations,
repeated sign-in idempotency, password reset, old-password rejection,
new-password acceptance, and old-session invalidation. Cart/Wishlist remained
available after reset. The direct cleanup audit confirmed zero disposable
users, credentials, reset tokens, user-owned commerce fixtures, merge markers,
and targeted guest fixtures. Eleven abandoned test accounts from earlier
interrupted attempts were removed using explicit test-only prefixes, with a
zero-result follow-up audit.

Security review confirmed session/public DTOs expose only public `userId`,
server session determines commerce ownership, disabled/unknown account handling
stays generic, and test-mail capture is non-production-only and secret
protected. Full TypeScript passed. Full ESLint passed with zero errors and one
existing warning in `SignInForm.tsx`; `git diff --check` passed. Isolated clean
baseline production build passed. Stage 6.6 introduced no production/runtime
source changes, so its production source set is identical to that baseline.
The current Owner/local-source snapshot still fails at `/_not-found` due
preserved Header/Wishlist request-time reads outside Stage 6.6; no Owner code
was changed. Live production Atlas remains NOT VERIFIED; live Brevo delivery
remains NOT YET VERIFIED and neither blocks local closure. No commit/push was
made. Stage 7 has not started.

==================================================
ATHAR — PHASE 7 / STAGE 7.1 CHECKOUT FOUNDATION
==================================================

Official baseline: `5c4ec8139a358568509bd1fffb6041d2925ac0e8`.

Phase 7 stage map:

- 7.1 — Checkout Domain & Server-Authoritative Foundation (COMPLETE LOCALLY)
- 7.2 — Contact & Shipping Address (NOT STARTED)
- 7.3 — Shipping Methods / Delivery Selection (NOT STARTED)
- 7.4 — Totals, VAT & Discount Contract (COMPLETE — READY FOR CHECKPOINT)
- 7.5 — Inventory Reservation / Checkout Concurrency (COMPLETE — READY FOR CHECKPOINT)
- 7.6 — Phase 7 Integration & Closure (NOT STARTED)

Stage 7.1 contract:

- Checkout reads only the current server-selected CommerceOwner Cart. A signed-in
  user resolves to the session's public `userId`; a guest resolves to the
  existing opaque guest owner. Browser input cannot choose an owner.
- Every line is based on stored public Product/Variant identity and bounded
  quantity, then resolved against the canonical server Product/Variant,
  current availability, integer-minor-unit price, and currency.
- The read-model distinguishes eligible lines from stale/unavailable/invalid
  lines, subtotal, currency consistency, checkout status, and safe block reasons.
  Stale or unavailable lines remain visible, are excluded from eligible totals,
  and block continuing; empty/unavailable/mixed-currency carts also block.
- `/checkout` is a server-first review route. No checkout draft is created
  because Stage 7.1 has no durable checkout lifecycle requirement.
- No browser-provided name, price, quantity, subtotal, discount, shipping, or
  total is trusted. Money uses integer minor units only.
- No address/contact collection, shipping rates, VAT/tax, discounts, inventory
  reservation/decrement, payment provider integration, payment attempt, Order,
  order number, webhook, or order email is implemented in Stage 7.1.
- No Mongo checkout collection, repository, index, or durable draft is added;
  existing Cart persistence and canonical catalog reads remain the boundary.

Verification evidence: domain tests passed 6/6; dedicated-Mongo Browser E2E
passed 2/2 for guest stale/current-price review, authenticated user-owner
isolation, and ignored browser owner/price parameters. E2E `finally` assertions
verified deletion of the disposable guest Cart, two user Carts, two credentials,
and two Users from `athar_stage55_test`. Phase 5/6 unit regression set passed
42 with one separately gated Mongo transaction test skipped. TypeScript, full
ESLint (0 errors; one existing SignInForm warning), `git diff --check`, clean
baseline production build, and baseline plus Stage-7.1-only production build
passed. Agent Browser confirmed the empty-Cart state without browser errors.
No checkout-specific Mongo collection, draft, or index was added. Any future
Mongo tests must continue to use only `athar_stage55_test` and disposable data.
Stage 7.2+ are out of scope.

==================================================
ATHAR — PHASE 7 / STAGE 7.3 SHIPPING METHODS / DELIVERY SELECTION
==================================================

Official Stage 7.3 baseline: `e9119bbaa4d275dcc203f2fbb49514ae5c220d54`.
Owner-approved launch policy: Sweden (`SE`) only; PostNord service-point style
delivery; `5900` SEK minor units below a `69900` eligible-cart subtotal and
free delivery at or above it. No delivery-time promise is made.

The server resolves the current owner, Cart, address, policy, method activity,
currency, and charge on every read or selection. The browser submits only an
opaque checkout reference, revision, and public method ID. The draft persists
only that public ID; it never makes a shipping amount or carrier result
authoritative. A non-SE address clears the selection and cannot progress.

PostNord merchant-service configuration and perfume dangerous-goods/
limited-quantity fulfillment acceptance are **NOT YET VERIFIED — REQUIRED
BEFORE PRODUCTION SHIPPING GO-LIVE**. Stage 7.3 adds neither carrier API,
labels, EDI, fulfillment, VAT, discounts, inventory, payment, nor Orders.

==================================================
ATHAR — PHASE 7 / STAGE 7.4 TOTALS, VAT & DISCOUNT CONTRACT
==================================================

Official Stage 7.4 baseline: `1d3549e238f1995357285e8fc60e8ca157d501b4`.
The current Sweden-only Checkout derives a single server-authoritative,
integer-minor-unit totals model from the canonical Cart, the approved selected
PostNord method, and the owner-bound Checkout draft. Customer prices and the
`5900` shipping charge are VAT-inclusive. At the current 25% policy rate, VAT
is extracted with deterministic integer half-up arithmetic and is not added to
the displayed price a second time. No production discount policy is approved:
`discountTotal` is `0` and no promotion/coupon UI exists.

Derived totals are not persisted as Checkout-draft authority. Browser subtotal,
discount, VAT, shipping, threshold, grand-total, and owner claims are ignored.
Inventory, payment, Order, invoice/receipt, and discount campaign work remain
out of scope. **Stage 7.4 is COMPLETE — READY FOR CHECKPOINT.**

==================================================
ATHAR — PHASE 7 / STAGE 7.2 CONTACT & SHIPPING ADDRESS
==================================================

Official Stage 7.2 baseline: `00b283151050fac514d1bc0f49bbe66eb26229cd`.
Stage 7.1 remains closed; this section does not reopen or alter its contract.

Stage 7.2 adds Checkout-scoped customer contact and shipping-address data to
the eligible `/checkout` flow. Before every read or mutation that allows
progress, the server re-reads the current owner Cart and canonical catalog
projection from Stage 7.1. A blocked, empty, unavailable, stale, invalid, or
mixed-currency Cart cannot proceed based on a previously saved draft.

When persistence is available, a strict Mongo-backed draft stores only:
opaque public `checkoutId`, server-derived owner type/id, revision, required
contact email, a normalized shipping address, timestamps, and expiry. Phone is
not required absent a documented owner policy. Mongo `_id` and owner
identity never enter public DTOs. The browser may return the opaque checkout ID
as a reference, but the server must resolve the authenticated owner from the
Auth.js session or the guest owner from the existing opaque Cart cookie, then
scope every lookup and CAS mutation by that owner. Browser input never chooses
`userId` or owner. Drafts contain no price, subtotal, tax, shipping, discount,
inventory, payment, or Order authority.

Contact requires a trimmed, validated, normalized email. Account email may
prefill from the canonical User record but remains editable checkout contact
data and never mutates User. Address requires bounded trimmed `firstName`,
`lastName`, `addressLine1`, `postalCode`, `city`, and uppercase two-letter
`countryCode` shape; `addressLine2` and `region` are optional. Do not invent a
supported-country list, rates, delivery promises, or address book. No billing
address or canonical User profile address is created. Do not put PII in URLs
or logs.

Mongo persistence is explicit and durable; no production or runtime in-memory
fallback is allowed. Checkout indexes are idempotently declared and run only
as controlled deployment/test setup, not as implicit request side effects.
Records expire after 30 days, matching the existing Cart/Wishlist inactivity
policy. Tests that write Mongo use only `athar_stage55_test`, random disposable
fixtures, verified cleanup, and no production database.

Stage 7.2 explicitly excludes Stage 7.3+, shipping methods/rates, VAT/tax,
discounts/coupons, inventory reservation/decrement, billing addresses, saved
account addresses, Stripe, PayPal, payment attempts, webhooks, Orders, order
numbers, and order email. No commit or push is part of this stage.

Stage 7.2 verification gate: guest and authenticated read/create/update with
reload persistence; field and optional-field validation; owner/guest isolation;
tampered identity rejection; stale/expired draft; CAS concurrency; canonical
email prefill without User mutation; no PII in URLs/logs/public metadata beyond
the rendered form; empty/ineligible Cart blocking; expiry/index idempotency and
verified cleanup. Run Stage 7.2 focused tests, relevant Stage 7.1/Phase 5/6
regressions, dedicated Mongo integration, Browser E2E, full TypeScript, full
ESLint, `git diff --check`, and isolated production builds for the official
baseline and Stage-7.2-only source. Do not alter or absorb Owner/local changes,
`next-env.d.ts`, `package-lock.json`, icons, caches, `debug.log`, `.env.local`,
or global `AGENTS.md`. The stage closes only after all gates pass, then stops at
`ATLAS_STOP` without starting Stage 7.3.
