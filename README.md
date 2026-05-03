# Indo-Japan Martial Arts Academy (IJMAA) — Karate Tracker

A Progressive Web App (PWA) for managing karate classes across multiple dojos. Built entirely as a client-side application — no backend server required. All data is stored locally in the browser using SQLite (via WebAssembly) and persisted with IndexedDB.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Application Workflow](#application-workflow)
- [Database Design](#database-design)
- [Authentication](#authentication)
- [Multi-Dojo Support](#multi-dojo-support)
- [Backup & Restore](#backup--restore)
- [Google Drive Integration](#google-drive-integration)
- [Routing](#routing)
- [Getting Started](#getting-started)
- [Build & Deployment](#build--deployment)
- [Configuration](#configuration)

---

## Features

- **Student Management** — Add, edit, and manage students with belt ranks, contact info, and fee plans
- **Daily Attendance** — Mark attendance (present/absent) for each student per day
- **Monthly Attendance Report** — View per-student attendance summary with percentage for any month
- **Payment Tracking** — Generate monthly fee records, track paid/pending/overdue status
- **Multi-Dojo Support** — Manage multiple dojo locations from a single app instance
- **WhatsApp Reminders** — Send payment reminders via WhatsApp with customizable templates
- **Google Drive Backup** — Automatic daily cloud backup with manual backup/restore
- **Local Backup** — Export/import the entire database as a `.db` file
- **Offline-First** — Runs entirely in the browser with no internet dependency (except Google Drive sync)
- **Responsive UI** — Mobile-first design with bottom navigation (mobile) and side navigation (desktop)

---

## Tech Stack

| Technology | Purpose |
|---|---|
| **Angular 15** | Frontend framework |
| **Angular Material 15 (MDC)** | UI component library |
| **sql.js** | SQLite compiled to WebAssembly — full SQL database in the browser |
| **idb** | Promise-based IndexedDB wrapper for persisting the SQLite database file |
| **RxJS** | Reactive state management (dojo selection, data refresh) |
| **TypeScript 4.9** | Type-safe development |
| **SCSS** | Component styling |
| **Google Drive API v3** | Cloud backup via OAuth 2.0 implicit flow |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (Client)                     │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌────────────┐ │
│  │   Angular     │    │   sql.js     │    │  IndexedDB │ │
│  │   App UI      │───▶│   (SQLite    │───▶│  (Binary   │ │
│  │   (Material)  │    │    WASM)     │    │   .db)     │ │
│  └──────────────┘    └──────────────┘    └────────────┘ │
│         │                                       │        │
│         │            ┌──────────────┐           │        │
│         └───────────▶│ Google Drive │◀──────────┘        │
│           (OAuth2)   │   API v3     │  (backup file)     │
│                      └──────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

### Layered Architecture

```
┌─────────────────────────────────────────────┐
│              Feature Modules                 │
│  (Dashboard, Students, Attendance,           │
│   Payments, Settings, Backup, Login)         │
├─────────────────────────────────────────────┤
│              Shared Module                   │
│  (ConfirmDialog, AlertDialog)                │
├─────────────────────────────────────────────┤
│              Core Services                   │
│  (Database, Auth, Student, Attendance,       │
│   Payment, Dojo, Settings, WhatsApp,         │
│   GoogleDrive)                               │
├─────────────────────────────────────────────┤
│              Core Models                     │
│  (Student, Attendance, Payment, Dojo)        │
├─────────────────────────────────────────────┤
│              Database Layer                  │
│  (sql.js SQLite WASM + idb IndexedDB)        │
└─────────────────────────────────────────────┘
```

### Key Architectural Decisions

1. **No Backend** — The entire application runs in the browser. SQLite (via WebAssembly) provides a full relational database without any server.
2. **IndexedDB Persistence** — The SQLite database binary is serialized and stored in IndexedDB after every write operation, ensuring data survives page refreshes.
3. **Lazy-Loaded Feature Modules** — Each feature is a separate Angular module loaded on demand, keeping the initial bundle small (~913 KB).
4. **Hash Routing** — Uses `useHash: true` for compatibility with GitHub Pages (which doesn't support server-side URL rewriting).
5. **Reactive Dojo Selection** — `DojoService` exposes a `BehaviorSubject` that all feature components subscribe to, enabling instant data refresh when the user switches dojos.

---

## Project Structure

```
src/
├── app/
│   ├── app.module.ts                    # Root module with APP_INITIALIZER
│   ├── app-routing.module.ts            # Route definitions with lazy loading
│   ├── app.component.ts                 # Root component
│   │
│   ├── core/                            # Singleton services & models
│   │   ├── db/
│   │   │   └── migrations.ts            # Schema migrations (versioned)
│   │   ├── guards/
│   │   │   └── auth.guard.ts            # Route protection
│   │   ├── models/
│   │   │   ├── student.model.ts         # Student interface + BELT_RANKS
│   │   │   ├── attendance.model.ts      # Attendance & AttendanceRecord
│   │   │   ├── payment.model.ts         # Payment, PaymentRecord, FeePlan
│   │   │   └── dojo.model.ts            # Dojo interface
│   │   └── services/
│   │       ├── database.service.ts      # sql.js init, IndexedDB persistence
│   │       ├── auth.service.ts          # SHA-256 password hashing, session
│   │       ├── student.service.ts       # Student CRUD (dojo-scoped)
│   │       ├── attendance.service.ts    # Attendance CRUD + monthly report
│   │       ├── payment.service.ts       # Payments, fee plans, overdue logic
│   │       ├── dojo.service.ts          # Dojo CRUD + selection management
│   │       ├── settings.service.ts      # Key-value settings
│   │       ├── whatsapp.service.ts      # WhatsApp URL builder
│   │       └── google-drive.service.ts  # Google Drive OAuth + backup
│   │
│   ├── features/                        # Lazy-loaded feature modules
│   │   ├── login/                       # Login & first-time password setup
│   │   ├── shell/                       # App shell (toolbar, sidenav, bottom nav)
│   │   ├── dashboard/                   # Overview: stats, overdue alerts
│   │   ├── students/                    # Student list + add/edit form
│   │   ├── attendance/
│   │   │   ├── daily-attendance/        # Mark daily attendance
│   │   │   └── monthly-report/          # Monthly attendance summary table
│   │   ├── payments/
│   │   │   └── payment-list/            # Payment records, generate fees, reminders
│   │   ├── settings/                    # Currency, due day, WhatsApp, fee plans, dojos
│   │   └── backup/                      # Local export/import + Google Drive backup
│   │
│   └── shared/                          # Shared UI components
│       ├── shared.module.ts
│       ├── confirm-dialog/              # Yes/No confirmation dialog
│       └── alert-dialog/                # Info/warning/success alert dialog
│
├── assets/
│   ├── logo.jpeg                        # Academy logo
│   └── sql-wasm.wasm                    # SQLite WebAssembly binary
│
├── typings/
│   └── sql.js.d.ts                      # Custom type declarations for sql.js
│
├── index.html                           # App entry point
├── 404.html                             # GitHub Pages SPA redirect
└── styles.scss                          # Global styles + Material theme
```

---

## Application Workflow

### First-Time Setup

```
User opens app → No password set → Prompt to create password
                                   → Password hashed (SHA-256)
                                   → Stored in settings table
                                   → Redirected to Dashboard
```

### Daily Usage Flow

```
1. Login (password verified against stored hash)
   └─→ Auto Google Drive backup (if connected & not backed up today)

2. Dashboard shows:
   ├── Today's attendance status
   ├── Total active students
   ├── Overdue payment count & amount
   └── Quick links to key actions

3. Attendance (daily):
   ├── Select date (prev/next navigation)
   ├── Tap students to toggle present/absent
   ├── Bulk mark all present/absent
   └── Save attendance

4. Attendance (monthly report):
   ├── Select month (prev/next navigation)
   └── View per-student: Present(P), Absent(A), Percentage(%)

5. Payments:
   ├── Generate monthly fees (creates records for active students)
   ├── View by month or filter by status
   ├── Mark individual payments as paid
   └── Send WhatsApp reminders for overdue

6. Students:
   ├── Add/edit student details
   ├── Assign belt rank, fee plan
   └── View active/inactive students

7. Settings:
   ├── Currency, default due day
   ├── WhatsApp message template
   ├── Fee plan management
   ├── Dojo management (add/edit/delete)
   └── Change password
```

### Dojo Switching

```
User selects dojo (toolbar/sidenav)
  → DojoService.selectDojo() emits new value
  → All subscribed components reload data for new dojo
  → Students, attendance, payments all scoped to selected dojo
```

---

## Database Design

### Schema (Managed via Migrations)

**`settings`** — Key-value configuration store
| Column | Type |
|--------|------|
| key | TEXT PRIMARY KEY |
| value | TEXT |

**`dojos`** — Dojo/location management
| Column | Type |
|--------|------|
| id | INTEGER PRIMARY KEY |
| name | TEXT NOT NULL |
| location | TEXT |
| phone | TEXT |
| is_active | INTEGER DEFAULT 1 |

**`students`** — Student records
| Column | Type |
|--------|------|
| id | INTEGER PRIMARY KEY |
| name | TEXT NOT NULL |
| phone | TEXT |
| whatsapp_number | TEXT |
| belt_rank | TEXT |
| join_date | TEXT |
| is_active | INTEGER DEFAULT 1 |
| dojo_id | INTEGER NOT NULL DEFAULT 1 |

**`attendance`** — Daily attendance records
| Column | Type |
|--------|------|
| id | INTEGER PRIMARY KEY |
| student_id | INTEGER (FK → students) |
| date | TEXT |
| status | TEXT ('present' or 'absent') |
| UNIQUE | (student_id, date) |

**`fee_plans`** — Fee plan templates
| Column | Type |
|--------|------|
| id | INTEGER PRIMARY KEY |
| name | TEXT |
| monthly_amount | REAL |
| dojo_id | INTEGER NOT NULL DEFAULT 1 |

**`student_fee_plan`** — Links students to fee plans
| Column | Type |
|--------|------|
| student_id | INTEGER (FK → students) |
| fee_plan_id | INTEGER (FK → fee_plans) |

**`payments`** — Monthly payment records
| Column | Type |
|--------|------|
| id | INTEGER PRIMARY KEY |
| student_id | INTEGER (FK → students) |
| month_year | TEXT (e.g., '2026-05') |
| amount_due | REAL |
| amount_paid | REAL |
| due_date | TEXT |
| paid_date | TEXT |
| status | TEXT ('pending', 'paid', 'overdue') |

### Migration System

- Schema version tracked in `settings` table (`schema_version` key)
- Migrations defined in `core/db/migrations.ts` as versioned SQL arrays
- Run sequentially on app startup — only applies migrations newer than current version
- Current schema version: **2**
  - v1: Initial schema (all tables, seed data, indexes)
  - v2: Added `dojos` table, `dojo_id` columns to `students` and `fee_plans`

---

## Authentication

- **Client-side only** — acts as a UI gate, not server-grade security
- Password hashed using **SHA-256** via `crypto.subtle.digest()`
- Hash stored in `settings` table (key: `admin_password`)
- Session tracked via `sessionStorage` — cleared when tab closes
- Route protection via `AuthGuard` on all routes except `/login`

---

## Multi-Dojo Support

- Each dojo has its own students, fee plans, and attendance records
- `DojoService` manages dojo selection via `BehaviorSubject<number>`
- Selection persisted to `localStorage` across sessions
- All data services (`StudentService`, `AttendanceService`, `PaymentService`) filter queries by `dojo_id`
- Deleting a dojo cascade-deletes all associated data (students, attendance, payments, fee plans)
- Dojo selector shown in toolbar (mobile) and sidenav (desktop) — hidden when only 1 dojo exists

---

## Backup & Restore

### Local Backup
- **Export**: Downloads the entire SQLite database as a `.db` file
- **Import**: Upload a `.db` file to replace all current data (with confirmation dialog)

### Google Drive Backup
- Uses **OAuth 2.0 implicit flow** with `drive.file` scope
- Backups stored in a `KarateTrackerBackups` folder in the admin's Google Drive
- **Auto-backup**: Triggers silently on first login of each day
- **Manual backup**: "Backup Now" button on the Backup page
- **Restore**: Select any cloud backup to restore from
- **Cleanup**: Automatically keeps only the last 7 backups
- OAuth Client ID configured in `google-drive.service.ts`

---

## Routing

| Route | Module | Description |
|-------|--------|-------------|
| `/login` | LoginModule | Login / first-time password setup |
| `/dashboard` | DashboardModule | Overview stats and quick actions |
| `/students` | StudentsModule | Student list |
| `/students/add` | StudentsModule | Add new student |
| `/students/edit/:id` | StudentsModule | Edit existing student |
| `/attendance` | AttendanceModule | Daily attendance marking |
| `/attendance/monthly` | AttendanceModule | Monthly attendance report |
| `/payments` | PaymentsModule | Payment list with generate/filter |
| `/settings` | SettingsModule | App configuration |
| `/backup` | BackupModule | Backup & restore (local + Google Drive) |

All routes except `/login` are protected by `AuthGuard`. The app shell (`ShellComponent`) wraps all authenticated routes with toolbar and navigation.

**Mobile Navigation (bottom nav):** Dashboard, Students, Attendance, Payments

**More Menu (3-dot icon):** Settings, Backup, Logout

---

## Getting Started

### Prerequisites

- **Node.js** 18.x or later
- **npm** 10.x or later
- **Angular CLI** 15.x (`npm install -g @angular/cli@15`)

### Installation

```bash
git clone <repository-url>
cd karate-tracker
npm install
```

### Development Server

```bash
ng serve
```

Navigate to `http://localhost:4200/`. The app reloads on source changes.

### First Run

1. Open the app in a browser
2. Set an admin password (minimum 4 characters)
3. Go to **Settings** to configure:
   - Currency symbol
   - Default payment due day
   - WhatsApp message template
   - Add fee plans
   - Add additional dojos (optional)
4. Go to **Students** to add students
5. Start tracking attendance and payments

---

## Build & Deployment

### Production Build

```bash
ng build
```

Output is in `dist/karate-tracker/`. All files are static — deploy to any static hosting.

### GitHub Pages Deployment

The app is configured for GitHub Pages:
- Hash routing (`useHash: true`) avoids 404 issues on direct URL access
- `404.html` included as a fallback SPA redirect
- Deploy the contents of `dist/karate-tracker/` to your GitHub Pages branch

### Google Drive Setup (Optional)

To enable Google Drive backup:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project and enable the **Google Drive API**
3. Create an **OAuth 2.0 Client ID** (Web application type)
4. Add your deployed URL as an **Authorized JavaScript origin**
5. The Client ID is already configured in `google-drive.service.ts`

---

## Configuration

### Settings (In-App)

| Setting | Description | Default |
|---------|-------------|---------|
| Currency | Currency symbol for payment display | ₹ |
| Default Due Day | Day of month for payment due dates | 5 |
| WhatsApp Template | Message template for payment reminders | — |

### Build Configuration (angular.json)

| Setting | Value |
|---------|-------|
| Initial bundle warning | 1 MB |
| Initial bundle error | 2 MB |
| Component style warning | 4 KB |
| Component style error | 8 KB |
| Output path | `dist/karate-tracker` |
| Style preprocessor | SCSS |

---

## License

Private — Indo-Japan Martial Arts Academy
