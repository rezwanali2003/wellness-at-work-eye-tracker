text
# 👁️ Wellness at Work – Cloud‑Synced Eye Tracker

<div align="center">

[![Typing SVG](https://readme-typing-svg.herokuapp.com?font=Fira+Code&size=24&pause=1000&color=38BDF8&center=true&vCenter=true&width=900&lines=Cross-Platform+Eye+Blink+Tracker;Real-Time+Desktop+App+%2B+Cloud+Sync;FastAPI+%2B+AWS+RDS+%2B+S3+%2B+Next.js;GDPR-Aware+Architecture;Production-Ready+Full-Stack+System)](https://github.com/)

</div>

---

> A cross‑platform eye‑blink tracker that runs on the desktop, syncs anonymized blink data to the cloud, and renders a modern, read‑only eye‑health dashboard on the web.

---

## 🧩 Project Overview

**Wellness at Work (WaW)** is a full‑stack system designed to monitor how often users blink while working on a laptop and turn that into meaningful, privacy‑aware eye‑health insights.

**Core goals:**

- 🖥️ Cross‑platform **desktop app** (PyQt) for real‑time blink tracking  
- ☁️ Secure **cloud backend** on AWS (FastAPI + RDS + S3)  
- 🌐 Read‑only **web dashboard** (Next.js on Vercel) for each user  
- 📦 Click‑to‑install **desktop installer** hosted on S3, exposed via the web UI  
- 🔐 Architecture explicitly shaped around **GDPR & security** requirements  

---

## 🏗️ High‑Level Architecture

<div align="center">

```mermaid
flowchart LR
  subgraph Desktop["Desktop App (PyQt)"]
    DUser[User Login]
    DBlink[Real-Time Blink Tracker]
    DPerf[CPU/RAM/Power Monitor]
    DQueue[Offline Queue + Retry]
  end

  subgraph Web["Web App (Next.js on Vercel)"]
    WReg[Register]
    WLogin[Login]
    WDash[Dashboard: Stats/History/Trends]
    WProxy[/api/backend proxy]
  end

  subgraph Backend["Backend (FastAPI on AWS)"]
    AAuth[/auth/login, /auth/register/]
    ABlinks[/api/user/me/blinks/]
    AStats[/api/user/me/stats/]
    ATrends[/api/user/me/trends/]
    AExport[/api/user/me/blinks/export/]
  end

  subgraph Data["Data Layer (AWS)"]
    RDS[(RDS: users, blink_events)]
    S3[(S3: Eyetracker installer)]
  end

  DUser -->|JWT| DBlink
  DBlink --> DQueue
  DQueue -->|Batch sync over HTTPS| ABlinks

  WReg --> WProxy --> AAuth
  WLogin --> WProxy
  WDash --> WProxy

  AAuth --> RDS
  ABlinks --> RDS
  AStats --> RDS
  ATrends --> RDS
  AExport --> RDS

  WDash -->|env-based S3 link| S3
</div>
🔁 End‑to‑End Flow
User registers on the web → backend creates user in RDS with consent + timezone.

User downloads the desktop app from S3 by clicking a button in the web UI.

On the desktop:

User logs in → receives a JWT from /auth/login.

Eye‑tracker script counts blinks in real time.

Blink events are batched and sent to /api/user/me/blinks (with offline queue if needed).

Backend stores events in RDS and exposes stats, history, and trend endpoints.

Web dashboard calls read‑only APIs via /api/backend proxy and presents eye‑health analytics per user.

🖥️ Desktop App (PyQt)
🎯 Role
Run locally on the user’s laptop, monitor eye blinks, and sync anonymized metrics to the cloud while showing health indicators and resource usage.

🔧 Technology & Features
Framework: PyQt (Python)

Platforms: Windows (packaged .exe), designed for macOS compatibility

Core UI elements:

Real‑time blink rate (bpm) and cumulative blink count

CPU usage (%), memory usage (MB), and approximate power/energy impact

Online/offline status indicator for sync

📡 Offline‑First Sync Strategy
When online, the app sends batches like:

json
{
  "events": [
    {
      "timestamp": "2025-12-20T04:15:30Z",
      "blink_delta": 3,
      "session_id": "uuid",
      "session_duration_sec": 600,
      "session_rate_bpm": 14.2
    }
  ]
}
When offline:

Events are written to a small local queue (e.g. JSON/SQLite).

A retry worker periodically attempts to flush the queue once connectivity returns.

The ingest API is designed to accept idempotent batches, so resends are safe.

🔔 Optional / Planned Enhancements
System notifications when blink rate falls below a healthy threshold.

Tray/menu‑bar icon so the app can run quietly in the background.

Migration of blink logic to C++ for high‑performance scenarios.

☁️ Backend & Database (FastAPI + AWS)
🎯 Role
Provide a secure, multi‑tenant API surface for ingesting blink data from desktops and powering the read‑only web dashboard.

🧱 Stack
Framework: FastAPI (Python)

Infra: AWS EC2 (inside a VPC)

Database: AWS RDS (e.g. Postgres or MySQL)

Storage: AWS S3 for installer distribution

🗃️ Conceptual Schema
users

id (UUID)

email (unique)

name

password_hash

timezone (IANA string)

consent_given (boolean)

consent_at (timestamp)

created_at (timestamp)

blink_events

id (UUID)

user_id (FK → users.id)

timestamp (UTC)

blink_delta (int)

session_id (UUID)

session_duration (seconds)

session_rate (double)

created_at (timestamp)

Optional aggregates (for performance)

user_blink_daily_aggregates for per‑day totals and average blink rate.

🔐 Core API Endpoints
Auth

POST /auth/register

Body: email, password, name, consent_given, timezone

Stores consent and timezone at registration time.

POST /auth/login

Body: email, password

Returns: { "access_token": "<JWT>", "token_type": "bearer" }

Desktop blink ingest

POST /api/user/me/blinks

Auth: Authorization: Bearer <JWT>

Body: { "events": [ { ... } ] }

Accepts batches; safe to retry on network errors.

Dashboard data (read‑only)

GET /api/user/me/stats

Summaries: total blinks, today’s blinks, avg blink rate, total sessions, total time, peak hour, consistency score.

GET /api/user/me/blinks?range_period=week

Recent blink events windowed by day/week/month.

GET /api/user/me/trends?period=week

Time‑series trend data with direction (“up/down/stable”) and summary (best day, average daily blinks).

GET /api/user/me/blinks/export?format_type=csv&days=30

CSV export for offline analysis.

All user endpoints are scoped by the JWT subject, so each user sees only their own records.

🌐 Web Dashboard (Next.js + Vercel)
🎯 Role
Provide a modern, read‑only web experience where users can see their blink statistics, history, and trends.

🛠️ Tech & Deployment
Framework: Next.js (React, Pages Router)

Hosting: Vercel

Styling: Tailwind CSS + custom components

📄 Main Pages
/register
Collects:

Name

Email

Password

Region / timezone

Consent checkbox

On successful registration:

Shows a short success message.

Presents two primary actions:

🔽 Download Desktop App – uses NEXT_PUBLIC_EYETRACKER_URL (S3 public URL).

🔐 Go to Login – routes to /login.

/login
Validates credentials via the backend (/api/backend?path=auth/login).

Stores JWT in localStorage under waw_token.

Redirects to /dashboard on success.

/dashboard
Reads JWT from localStorage.

Fetches:

fetchDashboardStats → /api/user/me/stats

fetchBlinkData → /api/user/me/blinks

fetchTrends → /api/user/me/trends

exportBlinks → CSV endpoint

UI sections:

Hero card with current blink rate and risk label:

Healthy / Warning / High Risk, based on bpm thresholds.

Stats grid:

Total blinks, today’s blinks, average rate, peak hour, total sessions/time.

Tabs:

Overview – high‑level trends and quick tips.

History – scrollable table of recent blink events.

Trends – chart + summary metrics.

🧷 Single Proxy Route
To avoid mixed content and centralize backend config, all browser calls go through:

text
Browser (HTTPS)
  → /api/backend?path=...   (Vercel API Route)
  → BACKEND_BASE/path       (FastAPI on EC2, server‑to‑server)
Environment variables:

BACKEND_BASE – backend base URL (used only in /api/backend).

NEXT_PUBLIC_EYETRACKER_URL – S3 URL for the installer, referenced in the UI.

🔒 GDPR & Privacy
✅ Implemented
Data minimization

No raw video or images are stored or transmitted.

Data stored: blink counts, timestamps, session metadata, and basic profile info.

Consent

Users must explicitly consent to anonymized blink tracking during registration.

Consent flags and timestamps are stored in the users table.

Purpose limitation

Data is used solely for eye‑health analytics and personalized feedback; no profiling/marketing.

Per-user isolation

JWT‑secured endpoints ensure that each user can only fetch their own stats, history, and trends.

🧭 Planned with More Time
Right to erasure & export

DELETE /api/user/me to remove user and all associated blink data.

GET /api/user/me/export to provide full data export for self‑service GDPR requests.

Retention policies

Define and enforce retention windows (e.g. delete raw events after N days, keep only aggregates).

Scheduled cleanup jobs on RDS.

DPIA & DPO

Conduct a Data Protection Impact Assessment for workplace eye tracking.

Document a Data Protection Officer contact and data processing terms.

🛡️ Security
✅ Implemented
Authentication & authorization

JWT‑based auth for all user‑specific endpoints.

Passwords stored as secure hashes (e.g. bcrypt).

Transport security

Web served via HTTPS on Vercel.

Backend accessed over HTTPS or behind a TLS‑terminating load balancer.

Desktop app communicates with backend only via HTTPS endpoints.

Infrastructure controls

Backend runs inside an AWS VPC.

RDS is not exposed to the public internet.

S3 bucket is public‑read only for the installer object; rest remains private.

🧭 Planned with More Time
API hardening

Rate limiting for auth and ingest routes.

AWS WAF for OWASP Top‑10 protections.

Secrets management

Migration of all secrets (DB URL, JWT secret) to AWS Secrets Manager / Parameter Store.

Regular key rotation policy.

Monitoring & audits

Centralized logs (CloudWatch / ELK).

Audit trails for admin actions and data exports.

Alerts for spikes in failed logins or unusual access patterns.

Dependency security

Automated dependency scanning (pip-audit, npm audit, Dependabot).

⚙️ CI/CD & Testing
CI/CD
Web (Next.js)

Deployed on Vercel.

On each push:

Installs dependencies.

Runs npm run build (and lint/tests if configured).

Build failures prevent deployment.

Backend (FastAPI)

Hosted on AWS EC2.

GitHub Actions (minimal example):

pip install -r requirements.txt

Smoke test that imports the FastAPI app (planned: full pytest suite).

Deployment can be automated from CI or performed via scripted SSH / container deploy.

Sample Test Cases (Designed)
Auth

Register with valid data → user row created and consent persisted.

Register with an existing email → appropriate error response.

Login with correct credentials → JWT returned and accepted by protected endpoints.

Login with wrong credentials → 401.

Call a protected endpoint with an expired/invalid JWT → 401.

Blink ingest

Valid JWT + small batch of events → 201 and rows visible in DB.

Invalid JWT → 401.

Large offline batch (queued by desktop) → all events stored, no duplicates.

Simulated network failure → events buffered locally; on recovery, data appears in stats.

Dashboard

Given a known fixture dataset:

/api/user/me/stats returns expected totals and averages.

/api/user/me/trends returns correct trend direction based on synthetic data.

/api/user/me/blinks respects range_period filters.

Web UI

Register page shows correct validation errors and success states.

Login redirects correctly to /dashboard when credentials are valid.

Dashboard renders:

“No blink data yet” message for new users.

Correct risk label for configured blink‑rate thresholds.

CSV export triggers a download with correct headers.

🚀 Build & Run (Summary)
Exact commands may differ slightly depending on how you structure backend/, web, and desktop folders. Adjust accordingly.

Backend (FastAPI)
bash
cd backend
python -m venv .venv
source .venv/bin/activate  # .venv\Scripts\activate on Windows
pip install -r requirements.txt

# Set env vars: DB_URL, JWT_SECRET, etc.
uvicorn app.main:app --reload
Web (Next.js)
bash
cd web
npm install  # or pnpm install / yarn
cp .env.example .env.local
# Set: BACKEND_BASE, NEXT_PUBLIC_EYETRACKER_URL
npm run dev
Desktop (PyQt)
bash
cd desktop
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
📦 Distribution
Windows

Packaged as a standalone .exe (e.g. via pyinstaller).

Uploaded to an S3 bucket (e.g. waw-desktop-downloads) with public‑read access for that object only.

Exposed in the web app via NEXT_PUBLIC_EYETRACKER_URL, shown on the register success screen and optionally the dashboard.

macOS (planned/optional)

Option A: TestFlight build.

Option B: Signed .app bundle with App Sandbox.

Option C: .dmg for local installation.

The chosen option can be documented here with build/signing steps.

Tester access

Distribution links or TestFlight invitations are intended to be shared with:

ishaan80@gmail.com

mehul.bhardwaj@outlook.com

This repository demonstrates a complete, production‑style full‑stack system: real‑time desktop tracking, secure cloud APIs, a modern web dashboard, and an architecture shaped around privacy and operational concerns, not just code.

text
undefined
