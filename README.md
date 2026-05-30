# kom-billing

Knockout Math **admin app** (students, classes, enrollments) plus monthly billing from Google Sheets (PDFs + WhatsApp).

**Phase 1:** Postgres roster, team allowlist, legacy billing at `/billing`.

**Phase 2 (attendance):** Admin + Tutor roles, weekly session generation, mark attendance, reschedule sessions, admin schedules makeup. Audit log on changes.

## Run locally

```bash
cd kom-billing
cp .env.example .env.local
# Set DATABASE_URL (Neon / Vercel Postgres) then:
npm run db:push
npm run dev
```

Open **http://localhost:3002** → `/students` (kom-website uses 3000).

### Database

1. Create a free [Neon](https://neon.tech) Postgres database.
2. Put the connection string in `DATABASE_URL`.
3. Run `npm run db:push` to create tables.

### First-time roster

1. Set `BILLING_ADMIN_PASSWORD` in `.env.local`.
2. **Students** → register each student (optional class on the form).
3. For billing from a sheet: **Billing** → **Connect Google** (Sheets OAuth).

### Roles

| Role | Who | Can do |
|------|-----|--------|
| **Owner** | `MASTER_ADMIN_EMAIL` (you), or site password | Everything: roster, team access, generate sessions, **schedule makeup**, billing |
| **Staff** | Google + allowlist as **staff** | Attendance, **enroll students**, **schedule makeup**, billing — **not** add classes, generate sessions, or team list |
| **Tutor** | Google + allowlist as **tutor** | Attendance for own classes only (`tutor_match`) |

- Run `npm run db:push` after pull (includes `site_allowlist.role` = `staff` \| `tutor`).
- **Attendance** → pick date → open class → tick Present / Waive / Pause / Free trial / M/U done.
- **Admin only:** amber “Schedule makeup” box on session page.
- **Tutors:** `/attendance/tutor` lists all their classes and sessions.

### Team access (owner only)

- **Sign in with Google** on `/login`.
- Owner → **Team access** → add **Staff** (office) or **Tutor** (teacher + name match).

### Deploy (`admin.knockoutmath.sg`)

Separate Vercel project pointing at this repo; add domain `admin.knockoutmath.sg`. Set env vars from `.env.example` and add production OAuth redirect URI.

### PDF layout preview (dev only)

While tweaking invoice/receipt design, use the live preview instead of downloading PDFs from the dashboard:

**http://localhost:3002/dev/pdf-preview**

Pick a dummy sample, then **Refresh PDF** after each code change. Disabled in production unless you set `ENABLE_PDF_PREVIEW=1`.

Invoice PDFs use **Helvetica** so text shows in Chrome’s PDF viewer (embedded Outfit renders blank). The billing UI still uses Outfit. Optional: `PDF_USE_OUTFIT=1` in `.env.local` to try Outfit in PDFs again.

---

## Google access (pick one)

### If you see “Service account key creation is disabled”

Your company/school Google Cloud **organisation policy** blocks JSON keys. Use **OAuth** below — no service account key needed.

### Option B: OAuth (recommended when keys are blocked)

Uses **your** Google account (the one that already owns the attendance sheets).

1. Same Cloud project → **APIs & Services** → enable **Google Sheets API**.
2. **OAuth consent screen** → External (or Internal if Workspace) → add your email as test user → scopes: add `.../auth/spreadsheets`.
3. **Credentials** → **Create credentials** → **OAuth client ID** → type **Web application**.
4. **Authorized redirect URI** (exact):
   ```
   http://localhost:3002/api/auth/google/callback
   ```
5. Copy Client ID and Client Secret into `.env.local`:
   ```
   GOOGLE_OAUTH_CLIENT_ID=....apps.googleusercontent.com
   GOOGLE_OAUTH_CLIENT_SECRET=...
   GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3002/api/auth/google/callback
   ```
6. Restart `npm run dev` → open the app → **Connect Google** → allow access.
7. No need to “Share” sheets with a robot email — it uses your account.

### Option A: Service account (only if keys are allowed)

1. Create service account → download JSON key.
2. `GOOGLE_SERVICE_ACCOUNT_JSON={...}` one line in `.env.local`.
3. Share each monthly sheet with the service account `client_email` as **Editor**.

### Alternative: Personal Google Cloud project

If you only need Option A: create the Cloud project while logged into a **personal @gmail.com** Google account (not your organisation’s Cloud). Keys are usually allowed there.

---

## Sheet format

- One spreadsheet per month (`05-2026`, etc.).
- One tab per weekday.
- Header: `Name | Contact | School |` + date columns + `Payment` | `Amount Payable | INV | Receipt No.`
  - **Payment** and **Amount Payable** may sit on the **black class row** above the `Name` row (column H / I in your layout); status is read from the **Payment** column — edit there, then reload the sheet
- `1` = billable · `Waive` = not · `Free Trial` / blue = not · `MU on …` / `M/U on …` = billable (yellow/green is visual only)

## Default lesson rates (when Amount Payable is blank)

| Class | Rate |
|-------|------|
| Sec 1–2 | $70 / lesson |
| Sec 3–4 | $85 / lesson |
| Sec 3–4, same student on **both** A-Math & E-Math rows | $77.50 / lesson |
| JC | $100 / lesson |
| Vera Ng, Lyra Ng | $90 / lesson |

Section headers should include level (e.g. `Sec 2 9:00…`, `Sec 4 A Math…`, `JC …`).  
Put a number in **Amount Payable** on the sheet to override for one student.

## PayNow on invoice

- PayNow on invoices: purple-bordered card with **PAYNOW** text and `public/paynow-qr-placeholder.png` (replace with your real SGQR PNG when ready, same filename or update `lib/pdf/assets.ts`)

## WhatsApp

Free `wa.me` links — you attach the PDF manually in WhatsApp Business.
