# Atmos Lifestyle – Careers & Recruitment Portal

This project has two parts: a public careers site and a private admin panel for HR. Candidates browse openings and apply with a resume. HR staff post jobs, manage departments and move candidates through a hiring workflow.

**Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui-style components (Radix), React Hook Form + Zod, Firebase Realtime Database (Admin SDK), Cloudinary for resumes, Lucide icons, Vitest.

---

## 1. Architecture

```
Browser ──► Next.js (Vercel)
             ├─ Server components ── read data with the Firebase Admin SDK
             ├─ /api/* route handlers ── validate (Zod) + authorise, then write
             └─ middleware ── session check + CSRF guard for /admin and /api/admin
                     │
                     ├──► Firebase Realtime Database  (all data; client access denied by rules)
                     └──► Cloudinary                    (resumes, private "authenticated" raw files)
```

### The browser never talks to the database

Every read and write goes through server code that uses the Firebase Admin SDK. The database rules deny all client access except the public-safe job index.

### Resume uploads happen in two steps

Large files never pass through Vercel's 4.5 MB request limit.

1. `POST /api/uploads/resume-signature` runs first. It checks that the job is open and that the file type and size are allowed. It then returns a one-time signed Cloudinary upload with a file ID chosen by the server.
2. The browser uploads the file directly to Cloudinary and shows a progress bar.
3. `POST /api/applications` runs last. It re-validates every field and confirms the file exists in Cloudinary. It checks the file's real size, downloads it, and checks the file's actual bytes (PDF, DOC or DOCX signatures). Only then does it save the application. Rejected uploads are deleted.

### Resumes are private

They are stored as Cloudinary `authenticated` raw files. The database keeps:
- the storage key (`resumePath`)
- the canonical Cloudinary URL (`resumeUrl`), which returns 401 without a signature
- the file name, type and size

Admins download through `/api/admin/applications/{id}/resume`. That route checks the session and redirects to a signed link that **expires in 60 seconds**.

### Admin authentication

- Usernames and bcrypt password hashes live in `/adminUsers`.
- Login issues an httpOnly, SameSite=Lax JWT cookie that lasts 8 hours by default.
- Middleware rejects missing or invalid tokens.
- Every page and API handler then **re-checks the admin record in the database**. The admin must be active and match the token's `sessionVersion`. This means deactivating an admin or changing a password revokes their sessions immediately.
- There is no sign-up page. Admins are created with a command-line script.

## 2. Billing and services

| Service | Plan needed | Notes |
|---|---|---|
| Firebase Realtime Database | **Spark (free) is enough** | Includes 1 GB stored and 10 GB/month download. No Cloud Functions or Firebase Storage are used, so the Blaze plan is **not** required. |
| Cloudinary | The free tier is fine to start | Resumes are small. The free tier gives about 25 credits per month. |
| Vercel | **Pro for a company site** | The Hobby plan is for non-commercial use only. Firebase Hosting with Cloud Run is an alternative, but it needs the Blaze plan. |
| SMTP (optional) | Any provider | For example a Gmail/Workspace app password, Zoho, Amazon SES or Brevo. |

## 3. Database structure (root of Realtime Database)

```
departments/{deptId}            name, isActive, createdAt, updatedAt
jobs/{jobId}                    title, description (sanitised HTML), departmentId, employmentType, location,
                                vacancies, applicationDeadline (ms, 23:59:59 IST), status (draft|published|closed),
                                isActive, createdAt, updatedAt, createdBy, lastUpdatedBy, publishedAt, closedAt
publicJobIndexes/{jobId}        public-safe copy of published jobs + departmentName (the only publicly readable path)
applications/{appId}            jobId, jobTitleSnapshot, departmentIdSnapshot, candidateName, phone, email, message,
                                resumePath, resumeUrl, resumeFileName, resumeContentType, resumeSize, resumeFormat,
                                status, appliedAt, updatedAt, recruiterNotes, reviewedBy, reviewedAt, consentAt, searchText
applicationStatusHistory/{appId}/{historyId}
                                previousStatus, newStatus, changedAt, changedBy (admin uid | "candidate"),
                                changedByName, note, emailStatus (sent|failed|skipped)
adminUsers/{uid}                username, usernameLower, displayName, email, role (admin|super_admin), isActive,
                                passwordHash (bcrypt), sessionVersion, createdAt, lastLoginAt
stats/applications              total, byStatus/{status}, byJob/{jobId}   (atomic counters for the dashboard)
settings                        notifications.sendAcknowledgement, notifications.sendStatusUpdates
applicationKeys/{jobId}/{hash}  one application per email per job (duplicate guard)
submissions/{idempotencyKey}    a retried submission returns the original application
loginAttempts/{hash}            brute-force lockout (5 failures → 15 min)
rateLimits/{bucket}/{hash}      per-IP limits on login, upload signing and submissions
```

IDs are Firebase push IDs. Timestamps are Unix milliseconds.

## 4. Security model

- **Database rules** (`database.rules.json`): `.read` and `.write` are **false at the root**. Only `publicJobIndexes` is publicly readable, and it holds no candidate data. Indexes are declared for every server query.
- **Storage rules** (`storage.rules`): Firebase Storage is locked shut, because resumes are kept in Cloudinary.
- **Validation:** every API route validates input on the server with Zod. Client-side validation is only a convenience.
- **Job descriptions** are sanitised with an allow-list before they are saved.
- **CSRF:** admin write requests must come from the same origin. Session cookies are `SameSite=Lax` and `httpOnly`.
- **Login protection:** unknown usernames and wrong passwords get the same error. Every attempt does the same bcrypt work, so response timing reveals nothing. Accounts lock after repeated failures, and each IP address is rate-limited.
- **Headers:** security headers are set (`nosniff`, `DENY` framing, a referrer policy). Admin pages are sent as `no-store` and `noindex`.

## 5. Setup

### 5.0 Check your setup at any time
```bash
npm run doctor
```
This checks `.env.local`, signs in to Firebase, reads the database (including which admin accounts exist), and pings Cloudinary. For each problem it prints the exact fix. In development, the careers page and the login form also show the real error instead of a generic message.

### 5.1a If your organisation blocks service-account keys
Use your own Google login instead of a key file. This works for local development:
1. Install the Google Cloud CLI from https://cloud.google.com/sdk/docs/install.
2. Run the command below, then sign in with the Google account that owns the Firebase project:
   ```bash
   gcloud auth application-default login --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/firebase.database,https://www.googleapis.com/auth/userinfo.email
   ```
3. In `.env.local`, set `FIREBASE_USE_ADC=true`. Leave `FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY` as the placeholders.
4. Run `npm run doctor`, then `npm run dev`.

For production, this login only works on your own machine. Either deploy to Firebase App Hosting or Cloud Run (both use Google's built-in identity, so no key is needed), or have the org admin allow a key once (see the org policy steps) and use it on Vercel.

### 5.1 Firebase (project `atmoscareer-3668c`)

1. In the Firebase console, open **Build → Realtime Database**. It already exists in `asia-southeast1`.
2. Open **Project settings → Service accounts → Generate new private key**.
   - Copy `client_email` into `FIREBASE_CLIENT_EMAIL`.
   - Copy `private_key` into `FIREBASE_PRIVATE_KEY`. Keep the quotes and the `\n` sequences.
   - Never commit this file.
3. Deploy the database rules. This needs `npm i -g firebase-tools` and `firebase login`.
   ```bash
   npm run rules:deploy      # deploys database.rules.json to the project in .firebaserc
   ```
   Alternatively, paste the contents of `database.rules.json` into **Realtime Database → Rules** and click **Publish**.

### 5.2 Cloudinary

1. In the Cloudinary console, open **Settings → API Keys**. Copy the cloud name, API key and API secret into the environment variables.
2. You don't need an upload preset, because the server signs every upload.
3. If downloads ever return "delivery blocked", open **Settings → Security** and allow delivery of PDF files.

### 5.3 Environment variables

The Firebase web config is already filled in. You only need to add the secrets.

```bash
cp .env.local.template .env.local
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # → SESSION_SECRET
```

See `.env.example` for every variable and what it does.

### 5.4 Install, seed, and create the first admin

```bash
npm install
npm run seed:departments                      # adds Sales, Presales, CRM, Construction, etc. (13 departments)
npm run admin:create -- --username lakshmi --email hr@yourcompany.com --name "Lakshmi Prasad" --role super_admin
# The script prompts for the password (input is hidden).
# Run it again for an existing username to reset that admin's password.
npm run admin:deactivate -- --username someone        # revoke access (add --activate to restore it)
npm run dev                                   # http://localhost:3000/careers and http://localhost:3000/admin/login
```

### 5.5 Sample data (optional, for testing)
`sample-data/atmos-sample-data.json` contains 13 departments, 7 jobs (5 published, 1 draft, 1 closed), 10 applications at different stages, and a default admin account:

| Username | Password |
|---|---|
| `admin` | `Atmos@2026Admin` |

Load it with `npm run seed:sample`, which merges the data into your database. Alternatively, open **Realtime Database → ⋮ → Import JSON** in the console, but note that importing at the root replaces everything in the database. **Change the password in Admin → Settings after your first sign-in.** The sample resumes are not real Cloudinary files, so their download buttons return an error.

### 5.6 Brand details

- Edit `src/config/site.ts` and replace the placeholder HR email, phone number and office address.
- Have your legal team review the privacy policy text in `src/app/(public)/privacy/page.tsx`.

## 6. Deploying to Vercel

1. Push the code to GitHub and import the repo in Vercel. Choose Next.js as the framework.
2. Under **Project → Settings → Environment Variables**, add **every** variable from `.env.example`. Set `APP_URL` to the production URL, for example `https://careers.atmoslifestyle.com`.
3. Deploy, then sign in at `/admin/login`.
4. Optionally, point a `careers.` subdomain at Vercel and link to it from the Career page on the main website.

## 7. Email notifications (optional)

Set `EMAIL_ENABLED=true` and fill in the `SMTP_*` and `EMAIL_FROM` variables. Then turn on the toggles in **Admin → Settings**.

- **Acknowledgement:** sent to the candidate when their application is saved.
- **Status updates:** when HR changes a status, they can tick "Email the candidate". Internal notes are never included in the email.

The admin panel only reports an email as "sent" when the SMTP server accepted the recipient. The result is recorded in the application's status history.

## 8. Tests

The suite uses an in-memory database fake, so it needs no network access or credentials.

```bash
npm test          # 55 tests (Vitest)
npm run typecheck
npm run build
```

**Public site:**
- Published jobs are visible; draft and closed jobs are hidden.
- Valid applications are saved.
- Invalid applications are rejected: bad fields, fake PDFs, oversized files, and files from another job's folder.
- Duplicate submissions are blocked, and retried submissions are handled idempotently.

**Admin access:**
- Admin pages and APIs reject anonymous users, forged tokens, deactivated admins and revoked sessions.
- Only admins can create, edit and close jobs, and change application statuses (which records history and updates counters).
- Resume downloads need a session and use a 60-second link.
- Closing or deleting a job keeps its applications.

**Login:**
- Accounts lock after repeated failed sign-ins.
- Cross-site requests are blocked (CSRF).

### Manual go-live checklist

- [ ] The rules are deployed (`.read` is false at the root), and an anonymous REST read of `/applications.json` returns *Permission denied*.
- [ ] The first admin is created, and `/admin/dashboard` redirects to the login page when signed out.
- [ ] You posted a test job, applied with a real PDF from a phone, and the application appears in Admin → Applications.
- [ ] A renamed `.exe → .pdf` file and a 10 MB file are both rejected.
- [ ] You downloaded a resume as an admin, waited 60 seconds, reloaded the Cloudinary link, and it had expired.
- [ ] After you close the job, it disappears from `/careers` and the apply link shows "closed", but the application is still in admin.
- [ ] The contact details in `src/config/site.ts` and the privacy policy text have been reviewed.

## 9. Project structure

```
src/
  app/
    (public)/careers/…            careers home, job details, apply
    (public)/contact, privacy
    admin/login                    sign-in
    admin/(panel)/…                dashboard, jobs (list/new/edit/preview), applications (list/detail),
                                   departments, settings – all guarded on the server
    api/
      applications                 public: save an application
      uploads/resume-signature     public: sign a Cloudinary upload
      auth/login, auth/logout
      admin/…                      jobs, departments, applications (+ resume), settings, account, maintenance
  components/ui                    shadcn-style primitives
  components/public, admin         feature components
  lib/
    validation/                    Zod schemas shared by client and server
    job-rules.ts, file-validation.ts
    auth/                          JWT session + same-origin check (edge-safe)
    server/                        firebase-admin, auth guards, cloudinary, email, repos/*
  middleware.ts
scripts/                           create-admin, deactivate-admin, seed-departments
tests/                             Vitest suite + in-memory RTDB fake
database.rules.json, storage.rules, firebase.json
```

## 10. Scaling notes

- **Filtering:** applications are filtered with an indexed Realtime Database query (by job, status, department or date range). The server then refines and paginates the results, and only one page is ever sent to the browser. The unfiltered list reads only the newest records needed for the current page.
- **Capacity:** this comfortably handles tens of thousands of applications. Beyond that, or if you need full-text search, add Algolia or Typesense, or move applications to Firestore. The repository layer (`src/lib/server/repos`) keeps that change contained.
- **Abandoned uploads:** if a candidate uploads a resume but never submits the form, the file stays in Cloudinary. Clear these periodically from the Cloudinary Media Library, or add a scheduled cleanup.
