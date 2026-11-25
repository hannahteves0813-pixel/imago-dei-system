# IMAGO DEI Patient Intake & Service Record Management System

A complete web-based client intake and service record system for Imago Dei
Health & Birth Center (laying-in clinic). Supabase backend (Postgres, Auth,
RLS, Storage) + static frontend that deploys to GitHub Pages.

## Features
- Secure login with two roles: **Administrator** and **Staff**
- Client registration: manual encoding OR picture/camera with in-browser OCR
  (Tesseract.js) + review before saving; original image stored securely
- Smart returning-client recognition: search-as-you-type with name + ID +
  contact shown; ONE profile per client (database-enforced, no duplicates)
- Client profile: full info + chronological service history (newest first)
- Service registration with multi-midwife assignment (checkbox reveals extra
  midwife fields), payment status, feedback, notes
- Midwife management (admin): IDs, contact, active/inactive, specializations
- Service catalog management (admin): names, durations, prices
- Dashboard: totals, today's services, recent registrations & transactions,
  quick-action buttons
- Reports: daily / weekly / monthly, client visit history, midwife records,
  most requested services, registrations — date filters, CSV (Excel) export,
  print-to-PDF
- Row Level Security on every table; private Storage bucket for intake images

## File structure
    index.html        app shell + CDN imports (Supabase JS v2, Tesseract.js)
    styles.css        ivory / navy / magenta design, responsive
    app.js            all application logic (configure keys at the top)
    assets/logo.jpg   clinic logo
    schema.sql        full database setup (tables, RLS, storage, triggers)
    make_admin.sql    promotes your first user to Administrator

## STEP 1 — Create the Supabase project
1. Go to https://supabase.com and sign in (free tier is enough to start).
2. **New Project** → name it (e.g. `imago-dei`) → set a database password → create.
3. Wait for the project to finish provisioning.

## STEP 2 — Create the database
1. In the Supabase dashboard: **SQL Editor → New query**.
2. Open `schema.sql` from this package, paste the ENTIRE file, click **Run**.
3. You should see "Success. No rows returned". Tables `clients`, `services`,
   `midwives`, `service_records`, etc. now exist under **Table Editor**.

## STEP 3 — Get your API keys
1. **Project Settings → API**.
2. Copy the **Project URL** and the **anon public** key.
3. Open `app.js` and replace the two values at the very top:
       const SUPABASE_URL      = 'https://YOUR-PROJECT-REF.supabase.co';
       const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';

## STEP 4 — Create the first ADMINISTRATOR account
There is no public sign-up page (by design).
1. **Authentication → Users → Add user → Create new user**.
   Enter the admin email and a strong password. (Email confirmation can stay
   disabled while testing.)
2. **SQL Editor → New query**, open `make_admin.sql`, change the email to the
   one you just created, paste, **Run**. This sets the role to `admin`.
3. Log in on the website with that account — you now have full access.

## STEP 5 — Create STAFF accounts (admin only)
- **Authentication → Users → Add user → Create new user** for each staff member.
- Every new user is automatically a **staff** member (via the signup trigger).
- To promote any of them later, re-run `make_admin.sql` with their email.

## STEP 6 — Add services and midwives
1. Log in as admin → **Services → Add Service** (name, price ₱, duration).
2. **Midwives → Register Midwife** (name, contact, status) and tick the
   **service specializations** each midwife can perform.
3. These lists populate the dropdowns used during service registration.

## STEP 7 — Deploy to GitHub Pages
1. Create a GitHub repository (e.g. `imago-dei-system`).
2. Upload all files, keeping the structure intact (`assets/logo.jpg` too).
3. **Settings → Pages → Source: Deploy from a branch → Branch: main, / (root) → Save.**
4. After a minute, the site is live at `https://YOUR-USERNAME.github.io/REPO-NAME/`.
5. Open it, log in, and confirm you can see the dashboard.

Because the frontend only talks to Supabase over HTTPS with the anon key,
the same live database works from any computer, tablet, or phone.

## OCR configuration
- OCR runs fully in the browser using Tesseract.js (already included via CDN).
- On the **Register Client** page choose the **Picture / Camera (OCR)** tab,
  then *Upload Image* (scanned form) or *Use Camera* (phone/tablet capture).
- The first OCR run downloads the English language model (~few MB) — it is
  cached afterwards.
- The OCR text is matched against labels like "Name:", "Address:",
  "Contact:", "Emergency Contact:", "Allergies:" and fields are pre-filled
  for review. ALWAYS check the extracted values before pressing
  **Save Client** — OCR can misread handwriting.
- The original image is saved to the private `intake-forms` Storage bucket
  and can be reopened from the client's profile ("View Uploaded Intake Form").
- Tuning: if your printed form uses unusual labels, edit the `applyOcrGuesses`
  function in `app.js` to add your own regex patterns.

## Security notes
- The anon key is safe to ship in frontend code: all data access is gated by
  Row Level Security policies (staff read/write records; only admins can
  delete or manage catalogs; storage bucket is private).
- Never put the `service_role` key in the frontend.
- Users are created only by the administrator inside Supabase — no public
  self-registration exists anywhere in the app.

## Data backup / export
- **Reports** → generate any report → **Export Excel (CSV)** for records.
- Full database backups: Supabase dashboard → **Settings → Database →
  Backups** (daily backups on paid plans; on the free tier use
  **Database → Backups → Dump** or the `pg_dump` instructions in Supabase docs).

## Testing checklist
1. **Login** — wrong password shows an error; correct password opens dashboard.
2. **Role check** — a staff account does NOT see Manage Midwives / Manage
   Services / delete buttons.
3. **Register client (manual)** — new client gets an auto ID like `IDC-1001`;
   redirect to profile works.
4. **Duplicate prevention** — registering the same name + same contact again
   shows a "already exists" error and creates nothing.
5. **OCR intake** — upload/capture a form; fields pre-fill; correct them;
   save; the intake image opens from the profile.
6. **Returning client** — type a name in Client Registry: suggestions show
   name + ID + contact; selecting one opens the existing profile (no new
   profile created).
7. **Add service** — from a profile, add a service; check "Add Another
   Midwife" to reveal extra midwife fields; price/duration auto-fill from
   the catalog; save; the entry appears at the TOP of the service history.
8. **Multiple services** — add several; confirm all remain under the same
   client, oldest at the bottom.
9. **Midwife specialization** — a midwife without the specialization appears
   disabled in the dropdown for that service.
10. **Persistence** — refresh the page, sign out and back in, and open the
    site on a second device: all records are still there (cloud database).
11. **Reports** — generate a monthly report, export CSV, and use Print/PDF.
12. **Admin vs staff on catalog** — staff cannot save midwife/service changes
    (RLS blocks it even if the UI is bypassed).

## Notes
- Currency is Philippine Peso (₱). To change it, edit the `peso()` helper in
  `app.js`.
- Client IDs start at IDC-1001 and midwife IDs at IDM-101 (sequences defined
  in `schema.sql`).
