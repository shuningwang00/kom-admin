# KOM Admin — application manual

Onboarding guide for **kom-billing** (KOM Admin at `admin.knockoutmath.sg`). Covers architecture, data flows, billing rules, and ops. Written for a new developer or staff member who needs the system at a glance.

For local setup and env vars, see the root [README](../README.md).

---

## What this app is

Knockout Math's **admin app** for:

1. **Roster** — students, classes, enrollments, trials
2. **Schedule** — direct class entry, session generation, calendar
3. **Attendance** — daily sessions, marking, makeups (M/U), waives
4. **Billing** — fully Postgres-native monthly invoices (PDF → Google Drive → WhatsApp)
5. **People** — staff claims, clock-in/out, availability, time-off

**Production:** `admin.knockoutmath.sg` deployed on Vercel.  
**Local:** `npm run dev` → http://localhost:3002

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js App Router |
| Database | Postgres via Neon + Drizzle ORM |
| Auth | Site password + Google OAuth |
| PDF | `@react-pdf/renderer` |
| File storage | Google Drive (per-file public link sharing) |
| Messaging | WhatsApp `wa.me` deep links |
| UI | Tailwind CSS |

Key library folders:

| Folder | Responsibility |
|--------|----------------|
| `lib/billing/` | Invoice compute, DB operations, rates |
| `lib/pdf/` | PDF document components, rendering, fonts |
| `lib/attendance/` | Sessions, makeup, hub, consolidation, headcount |
| `lib/enrollments/` | Eligibility, roster queries |
| `lib/scheduling/` | Session generation, time-slot parsing |
| `lib/google/` | Drive upload/delete/permissions, Sheets, OAuth |
| `lib/auth/` | Roles, access checks |
| `components/` | Page UI (billing dashboard, attendance, etc.) |

---

## Roles and access

| Role | Who | Can access |
|------|-----|------------|
| **Owner** | `MASTER_ADMIN_EMAIL` or site password | Everything |
| **Staff** | Google sign-in + allowlist `staff` | Attendance, students, enrollments, billing — not class CRUD or session generation |
| **Tutor** | Google sign-in + allowlist `tutor` | Own classes only: `/attendance/tutor` |

Auth: site password (`BILLING_ADMIN_PASSWORD`) + Google OAuth. Team list: **Settings → Manage Access** → `site_allowlist` table.

---

## Pages

| Route | What it does |
|-------|-------------|
| `/students` | Student roster, billing group assignment |
| `/classes` | Class timetable — Level + Subject per class |
| `/enrollments` | Student ↔ class links with start/end dates |
| `/schedule` | Direct session entry (replaces Google Sheet sync) |
| `/attendance` | Pick date → list sessions → mark attendance |
| `/attendance/session/[id]` | Mark roster; schedule makeup (staff+) |
| `/attendance/tutor` | Tutor's classes overview |
| `/makeup` | Hub: needs scheduling, scheduled, waived, relief |
| `/trials` | Trial leads → convert to student |
| `/calendar` | Month calendar of sessions |
| `/billing` | Monthly invoice dashboard — generate, track, send |
| `/programmes` | Holiday programmes |
| `/people/claims` | Staff expense claims |
| `/people/clock` | Clock-in/out |
| `/people/time-off` | Time-off requests |
| `/settings` | Manage access, permissions |

---

## Database schema

```
billing_groups ◄── students ──┬── enrollments ── classes ── class_sessions
                               │                                    │
                               │                         attendance_records
                               │
                               └── invoice_students ── invoices ── invoice_line_items
                                                              └──── invoice_payments
                               │
                               └── pending_credits
                               └── student_rate_overrides

trial_leads ──(convert)──► students
site_allowlist — auth emails / tutor_match
```

### Core tables

**`students`** — name, `parent_name`, school, `billing_group_id` (null = solo billing), `archived_at`.

**`billing_groups`** — groups siblings together so they share one invoice. Students in the same group are billed as one family row.

**`classes`** — `label` (auto-derived: `"${level} ${subject}"`), `level`, `subject`, weekday, time, tutor.

**`enrollments`** — links student ↔ class: `started_at`, `ended_at`, `registration_fee_due` (legacy flag — not used for new billing logic).

**`class_sessions`** — one row per class per date. `status`: `scheduled` | `cancelled` | `rescheduled_away`.

**`attendance_records`** — per student per session. `status`: `present` | `absent_pending` | `waive` | `pause` | `free_trial` | `makeup_scheduled` | `makeup_done` | `makeup_absent`.

### Billing tables

**`invoices`** — one per family (or solo student) per billing month.

| Column | Notes |
|--------|-------|
| `invoice_number` | Format `INV{YYYYMM}{seq:04}` e.g. `INV2026050001` |
| `status` | `draft` → `sent` → `partial` / `paid` → `void` |
| `subtotal` | Sum of tuition + registration fee line items |
| `discount_amount` | Manual discount entered at invoice generation |
| `balance_forward` | Outstanding balance from all prior unpaid invoices |
| `credit_applied` | Credits from overpayments or waived sessions |
| `total_due` | `subtotal − discount + balance_forward − credit_applied` |
| `total_paid` | Sum of all recorded payments |
| `pdf_file_id` | Google Drive file ID (set after PDF generation) |

**`invoice_students`** — junction table: which students are covered by each invoice. Primary key `(student_id, billing_month)` enforces one invoice per student per month. Rows are **deleted on void** so re-invoicing is possible.

**`invoice_line_items`** — one row per lesson (or fee/credit). Tagged with `student_id` so multi-student PDFs can group by child.

| `type` | Meaning |
|--------|---------|
| `tuition` | One lesson at resolved rate |
| `registration_fee` | One-time $40 reg + material fee |
| `balance_forward` | Unpaid amount from a prior invoice |
| `credit` | Overpayment or waived-session credit |
| `discount` | Manual discount |

**`invoice_payments`** — payment records linked to an invoice. Each payment updates `total_paid` and status. Overpayments create a `pending_credits` row.

**`pending_credits`** — credits available to offset future invoices. `applied_at` is set when consumed by an invoice; cleared if that invoice is voided.

**`student_rate_overrides`** — per-student (optionally per-class) rate, with optional `valid_from` / `valid_to` date range.

---

## Billing — how it works

### Rate resolution (per session)

1. Check `student_rate_overrides` — class-specific override wins over general override.
2. Fall back to `LESSON_RATES` by tier:

| Class | Rate |
|-------|------|
| Lower Sec (Sec 1–2) | S$70 / lesson |
| Upper Sec (Sec 3–4), single subject | S$85 / lesson |
| Upper Sec, same student on both A-Math **and** E-Math | S$77.50 / lesson (bundle) |
| JC | S$100 / lesson |

3. Fall back to `getDefaultRatePerSession()` from config for anything else.

### Session inclusion rules

- All sessions are billed by default.
- `waive` → billed at S$0 (shows on invoice as a waived line).
- `rescheduled_away` and `cancelled` → skipped entirely.
- Sessions outside the student's enrollment period (`started_at` / `ended_at`) → skipped.
- Makeup slots already covered by a `makeup_done` record → not double-billed.

### Effective start date (rolling un-invoiced months)

When computing an invoice for month M, sessions are fetched from **`effectiveStart`**, not just month M:

- `effectiveStart` = month after the **most recent non-voided invoice** for that student.
- If no prior invoice exists, falls back to the student's earliest enrollment start month.
- This means if a student was not invoiced in April, their April sessions automatically appear in May's invoice.

### Registration fee

- One S$40 fee per student, billed in the month their enrollment started.
- Only applies to enrollments that started on or after **2026-05-01** (legacy students are exempt).
- Checks `invoice_line_items` via `invoice_students` to confirm it hasn't been billed before (ignores voided invoices).

### Balance forward

All prior invoices with status `sent` or `partial` contribute their outstanding balance `(total_due − total_paid)` as a balance-forward line item.

### Invoice lifecycle

```
[INV button clicked]
       │
       ▼
  computeInvoicePreview()     ← shows line items in modal
       │
  [user confirms]
       │
       ▼
  createInvoice()             ← status: "draft", sentAt = now
       │
  [auto-trigger PDF generation]
       │
       ▼
  renderDbInvoicePdf()        ← @react-pdf/renderer
  uploadInvoicePdfToDrive()   ← Drive upload + set anyone-with-link permission
       │
       ▼
  Dashboard shows: PDF link + WA button + SENT button
       │
  [click WA] → opens WhatsApp with pre-filled message + Drive link
  [click SENT] → status: "sent"
       │
  [click PAID] → recordPayment() → status: "partial" or "paid"
  [click RCP]  → generates receipt PDF → Drive upload
       │
  [click VOID] → voidInvoice():
                  - status: "void"
                  - deletes invoice_students rows (enables re-invoicing)
                  - restores pending_credits
                  - deletes Drive files
                  - effectiveStart rolls back → sessions flow into next invoice
```

### Family invoicing (billing groups)

Students sharing a `billing_group_id` appear as **one row** on the billing dashboard and produce **one invoice** with per-student sections. Each line item is tagged with `student_id`. PDF sections are headed by the child's name. The contact name at the top is the parent name (`parent_name` from students table).

---

## PDF documents

### Invoice (`lib/pdf/db-invoice-document.tsx`)

- **Table**: Description (flex) | Amount (fixed 76px)
- Each tuition row: class label on line 1, date as smaller grey text on line 2
- Totals box: subtotal / discount / balance forward / credit (only shown when non-zero) + **Total due**
- Payment section: PayNow UEN + bank transfer details + QR card

### Receipt (`lib/pdf/db-receipt-document.tsx`)

- Same table structure as invoice (tuition lines only — no meta items)
- Green accent stripe at top
- Shows **Amount paid** instead of Total due
- Receipt number: `INV2026050001` → `RCP2026050001`

### File naming

- Invoice PDF: `INV2026050001-Student-Name.pdf`
- Receipt PDF: `RCP2026050001-Student-Name.pdf`

### Drive sharing

Every uploaded PDF has a file-level `type:anyone, role:reader` permission set immediately after upload. This makes the file viewable by anyone with the link, without exposing the folder or other files. If this call fails, the route throws a clear error.

---

## Attendance workflows

### Daily attendance

```
/attendance → pick date
    → listSessionsForDate (classes with active enrollments)
    → /attendance/session/[id]
    → mark: Present / Waive / Pause / Free trial / M/U done
    → attendance_records + audit_log
```

### Makeup (M/U)

1. Missed lesson → `absent_pending`
2. Makeup hub → **Needs scheduling** → pick date + class + optional custom time
3. Saves `makeup_scheduled` on missed record, optionally creates ad-hoc `class_session`
4. On M/U day → mark `present` → original record becomes `makeup_done` with note `MU on DD/MM`
5. Billing: `makeup_done` sessions are billed on the makeup date, not the original date. The original date is skipped via `makeupDoneDates` set in the billing engine.

### Waive

Marking a session `waive` sets rate to S$0. If a waived session is on an already-issued invoice, `handleWaivedSession()` removes the line item and recalculates `total_due`. Overpayment creates a `pending_credit`.

---

## End-to-end: billing month

1. **Generate sessions** for the month (owner — `/api/sessions/generate`).
2. Mark attendance throughout the month.
3. Open **Billing** → select month.
4. Dashboard shows all active students with enrolled classes, grouped by level (and "Siblings" for billing groups). Estimated totals are live previews using `computeInvoicePreview`.
5. Click **INV** → preview modal shows all line items, optional discount + remarks → **Generate invoice + PDF**.
6. PDF link appears → click **WA** to send parent a WhatsApp message with the Drive link.
7. Click **SENT** once you've confirmed delivery.
8. Parent pays → click **PAID** → enter amount + date → status updates.
9. Click **RCP** to generate and share receipt.
10. If correction needed → **VOID** → re-click INV to start fresh.

---

## API surface

| Area | Routes |
|------|--------|
| Auth | `/api/auth/login`, `/api/auth/me`, `/api/auth/google`, `/api/auth/logout` |
| Students | `/api/students`, `/api/students/[id]` |
| Billing groups | `/api/billing-groups`, `/api/billing-groups/[id]` |
| Classes | `/api/classes`, `/api/classes/[id]` |
| Enrollments | `/api/enrollments`, `/api/enrollments/[id]` |
| Sessions | `/api/sessions`, `/api/sessions/generate`, `/api/sessions/[id]`, `/api/sessions/[id]/attendance` |
| Makeup | `/api/makeup`, `/api/sessions/[id]/makeup-booking` |
| Trials | `/api/trials`, `/api/trials/[id]/convert` |
| Schedule (public) | `/api/public/schedule` |
| **Billing dashboard** | `GET /api/billing?month=YYYY-MM` |
| **Invoice preview** | `GET /api/billing/preview?studentIds=...&month=YYYY-MM` |
| **Create invoice** | `POST /api/billing/invoices` |
| **Invoice CRUD** | `GET/PATCH /api/billing/invoices/[id]` |
| **Record payment** | `POST /api/billing/invoices/[id]/payments` |
| **Generate PDF** | `POST /api/billing/invoices/[id]/pdf` |
| **Generate receipt** | `POST /api/billing/invoices/[id]/receipt` |
| People | `/api/claims`, `/api/clock`, `/api/staff-availability`, `/api/staff-time-off` |
| Admin | `/api/admin/teachers`, `/api/admin/permissions` |

Business logic lives in `lib/`, not in route handlers.

---

## Schedule changes (class weekday/time edits)

Changing a class's weekday or time **does not automatically update existing session rows** — sessions are generated once and stored with a fixed `scheduledDate`.

**Workflow when a class moves to a different day (e.g. Tuesdays → Mondays):**

1. Edit the class weekday in the Classes page.
2. Future unattended sessions on the old day are **automatically cancelled** (any `scheduled` session after today with no `present`/`makeup_done` attendance records).
3. **Regenerate sessions** for the affected months — new sessions are created on the new weekday. The old (now cancelled) sessions are skipped.

Sessions with existing attendance records are never auto-cancelled — cancel those manually if needed.

Sessions are only visible in the attendance view for classes that have at least one active enrolled student. Generating sessions for a class with no enrollments works and is safe — sessions exist in the DB but are hidden until the first student is enrolled.

---

## Common pitfalls

| Symptom | Cause / Fix |
|---------|-------------|
| Voided sessions not in next month's INV | Old void didn't delete `invoice_students` rows — void and re-generate with new code |
| Drive PDF link says "no access" | PDF was uploaded before `permissions.create` was added — void and re-generate |
| Invoice already exists error | `invoice_students` row from a voided invoice lingers — `createInvoice` purges these automatically now |
| Sessions from future months appearing in INV | Check `effectiveStart` — should be month after last non-voided invoice |
| Reg fee missing | Check enrollment `started_at` ≥ 2026-05-01 and no prior non-voided invoice has a reg fee line item for this student |
| Wrong M/U time in hub | Makeup note missing custom time — add `· 2pm – 3:45pm` style to note |
| 01-of-next-month leaking into current invoice | Session fetch uses `lt(scheduledDate, monthEnd)` not `lte` — already fixed |
| Old sessions still showing after weekday change | Auto-cancel only fires on save — manually cancel any sessions with existing attendance records |
| New weekday sessions missing after schedule change | Must regenerate sessions for affected months after changing class weekday |
| Trial student enrolled then drops out without paying | Void the invoice + end the enrollment (set an end date) — prevents balance carrying forward and stops future billing |

---

## File map for deep dives

| Topic | Start here |
|-------|------------|
| Invoice computation | `lib/billing/compute-invoice.ts` — `computeInvoicePreview`, `computeForStudent` |
| Invoice DB operations | `lib/billing/invoice-db.ts` — create, void, payments, dashboard query |
| Rate logic | `lib/billing/rates.ts`, `lib/billing/registration-fee.ts` |
| Invoice PDF | `lib/pdf/db-invoice-document.tsx` |
| Receipt PDF | `lib/pdf/db-receipt-document.tsx` |
| Drive upload + sharing | `lib/google/drive.ts` — `uploadPdfToDrive`, `deleteFileFromDrive` |
| Session list filter | `lib/attendance/list-sessions.ts` |
| Session page roster | `lib/attendance/session-detail.ts` |
| Makeup schedule / complete | `lib/attendance/makeup.ts`, `lib/attendance/makeup-booking.ts` |
| Makeup hub lists | `lib/attendance/makeup-hub.ts` |
| Slot merging | `lib/attendance/session-slot-matching.ts` |
| Enrollment eligibility | `lib/enrollments/eligibility.ts` |
| Time slots | `lib/scheduling/time-slots.ts` |
| Generate month sessions | `lib/scheduling/generate-sessions.ts` |
| DB schema | `lib/db/schema.ts` |

---

## Deploy

1. Push to repo → Vercel deploys `admin.knockoutmath.sg`.
2. Set env vars (see `.env.example`): `DATABASE_URL`, `BILLING_ADMIN_PASSWORD`, `MASTER_ADMIN_EMAIL`, Google OAuth credentials, Drive folder IDs.
3. Run pending migrations: `DATABASE_URL=... npx drizzle-kit migrate` (or apply SQL files in `drizzle/` manually via Neon console).
4. Google Cloud: ensure `https://admin.knockoutmath.sg/api/auth/google/callback` is an authorised redirect URI. Scopes needed: `spreadsheets`, `drive.file`.

**Migration to run if not yet applied:**
```sql
-- 0032: add draft invoice status
ALTER TYPE "public"."invoice_status" ADD VALUE 'draft';
```

---

*Last updated: June 2026 — reflects Postgres-native billing, family invoice grouping, draft/sent/void lifecycle, Drive public-link sharing, and WhatsApp integration.*
