# Indo-Japan Martial Arts Academy (IJMAA) — Karate Tracker

A Progressive Web App (PWA) for managing karate classes across multiple dojos. Built with Angular and Firebase — no backend server required. Data is stored in Cloud Firestore with offline support.

**Live App:** https://jibinthomasm.github.io/KarateTracker/

---

## Features

- **Student Management** — Add, edit, and manage students with belt ranks, contact info, and fee plans
- **Daily Attendance** — Mark attendance (present/absent) for each student per day
- **Monthly Attendance Report** — View per-student attendance summary with percentage for any month
- **Payment Tracking** — Generate monthly fee records, track paid/pending/overdue status
- **Multi-Dojo Support** — Manage multiple dojo locations from a single app instance
- **WhatsApp Reminders** — Send payment reminders via WhatsApp with customizable templates
- **Automatic Daily Backup** — GitHub Actions exports Firestore data daily (7-day retention)
- **Local Backup** — Export/import the entire database as a `.json` file
- **Offline Support** — Firestore offline persistence with multi-tab sync
- **Responsive UI** — Mobile-first design with bottom navigation (mobile) and side navigation (desktop)
- **Session-based Auth** — Login required each time the browser is opened
- **Email Allowlist** — Only authorized emails can access the app

---

## Tech Stack

| Technology | Purpose |
|---|---|
| **Angular 15** | Frontend framework |
| **Angular Material 15 (MDC)** | UI component library |
| **Firebase 9 (compat)** | Authentication + Cloud Firestore |
| **@angular/fire 7** | Angular bindings for Firebase |
| **RxJS** | Reactive state management |
| **TypeScript 4.9** | Type-safe development |
| **SCSS** | Component styling |
| **GitHub Actions** | Automated daily Firestore backup |
| **GitHub Pages** | Static hosting |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (Client)                      │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌────────────┐ │
│  │   Angular     │    │  Firestore   │    │  IndexedDB │ │
│  │   App UI      │───▶│  (Cloud DB)  │───▶│  (Offline  │ │
│  │   (Material)  │    │              │    │   Cache)   │ │
│  └──────────────┘    └──────────────┘    └────────────┘ │
│         │                                                │
│         │            ┌──────────────┐                    │
│         └───────────▶│ Firebase Auth │                   │
│                      │ (Email/Pass)  │                   │
│                      └──────────────┘                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                  GitHub Actions (Server)                  │
│                                                          │
│  Daily cron → firebase-admin → Export Firestore → Artifact│
└─────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

1. **Firebase Backend** — Firestore for data, Firebase Auth for login. No custom server needed.
2. **Offline Persistence** — Firestore's `enablePersistence` with `synchronizeTabs: true` allows offline usage.
3. **Session Auth** — Firebase persistence set to `SESSION` so login is required after closing the browser.
4. **Lazy-Loaded Feature Modules** — Each feature is a separate Angular module loaded on demand.
5. **Hash Routing** — Uses `useHash: true` for GitHub Pages SPA compatibility.
6. **Reactive Dojo Selection** — `DojoService` exposes a `BehaviorSubject` that all components subscribe to.
7. **Client-side Sorting** — Avoids Firestore composite index requirements by sorting in the app.

---

## Project Structure

```
src/
├── app/
│   ├── app.module.ts                    # Root module with Firebase init
│   ├── app-routing.module.ts            # Route definitions with lazy loading
│   │
│   ├── core/                            # Singleton services & models
│   │   ├── guards/
│   │   │   └── auth.guard.ts            # Route protection (AngularFireAuth)
│   │   ├── models/
│   │   │   ├── student.model.ts         # Student interface + BELT_RANKS
│   │   │   ├── attendance.model.ts      # Attendance & AttendanceRecord
│   │   │   ├── payment.model.ts         # Payment, PaymentRecord, FeePlan
│   │   │   └── dojo.model.ts            # Dojo interface
│   │   └── services/
│   │       ├── database.service.ts      # Firestore export/import (JSON)
│   │       ├── auth.service.ts          # Firebase Auth (login, password reset/change)
│   │       ├── student.service.ts       # Student CRUD (dojo-scoped)
│   │       ├── attendance.service.ts    # Attendance CRUD + monthly report
│   │       ├── payment.service.ts       # Payments, fee plans, overdue logic
│   │       ├── dojo.service.ts          # Dojo CRUD + selection management
│   │       ├── settings.service.ts      # Key-value settings (Firestore doc)
│   │       └── whatsapp.service.ts      # WhatsApp URL builder
│   │
│   ├── features/                        # Lazy-loaded feature modules
│   │   ├── login/                       # Email/password login + forgot password
│   │   ├── shell/                       # App shell (toolbar, sidenav, bottom nav)
│   │   ├── dashboard/                   # Overview: stats, overdue alerts
│   │   ├── students/                    # Student list + add/edit form
│   │   ├── attendance/
│   │   │   ├── daily-attendance/        # Mark daily attendance
│   │   │   └── monthly-report/          # Monthly attendance summary table
│   │   ├── payments/
│   │   │   └── payment-list/            # Payment records, generate fees, reminders
│   │   ├── settings/                    # Currency, due day, WhatsApp, fee plans, dojos, change password
│   │   └── backup/                      # Local export/import
│   │
│   └── shared/                          # Shared UI components
│       ├── confirm-dialog/
│       └── alert-dialog/
│
├── environments/
│   ├── environment.ts                   # Dev config (Firebase + allowedEmails)
│   └── environment.prod.ts             # Production config
│
├── assets/
│   └── logo.jpeg                        # Academy logo
│
├── index.html
├── 404.html                             # GitHub Pages SPA redirect
└── styles.scss                          # Global styles + Material theme

scripts/
└── firestore-backup.js                  # Node.js script for GitHub Actions backup

.github/workflows/
└── firestore-backup.yml                 # Daily cron backup workflow
```

---

## Firestore Data Model

### Collections

**`settings`** — Single document (`settings/config`) with key-value pairs

**`dojos`** — Dojo/location documents
| Field | Type |
|-------|------|
| name | string |
| location | string |
| phone | string |
| isActive | boolean |

**`students`** — Student documents
| Field | Type |
|-------|------|
| name | string |
| whatsappNumber | string |
| beltRank | string |
| joinDate | string |
| isActive | boolean |
| dojoId | string |
| feePlanId | string (optional) |

**`attendance`** — Attendance documents (ID: `{studentId}_{date}`)
| Field | Type |
|-------|------|
| studentId | string |
| studentName | string |
| beltRank | string |
| dojoId | string |
| date | string |
| status | string ('present' / 'absent') |

**`feePlans`** — Fee plan documents
| Field | Type |
|-------|------|
| name | string |
| monthlyAmount | number |
| dojoId | string |

**`payments`** — Payment documents (ID: `{studentId}_{monthYear}`)
| Field | Type |
|-------|------|
| studentId | string |
| studentName | string |
| whatsappNumber | string |
| dojoId | string |
| monthYear | string |
| amountDue | number |
| amountPaid | number |
| dueDate | string |
| paidDate | string |
| status | string ('pending' / 'paid' / 'overdue') |

---

## Authentication & Security

- **Firebase Auth** (Email/Password) — accounts created manually in Firebase Console
- **Session persistence** — login required each time the browser is opened
- **Email allowlist** — `environment.allowedEmails` restricts which emails can log in (UI-level)
- **Forgot Password** — sends Firebase password reset email
- **Change Password** — available in Settings (requires current password)
- **Firestore Rules** — recommended server-side restriction by email (see Security section below)

---

## Backup Strategy

### Automatic (GitHub Actions)
- Runs daily at **6:00 AM IST** (cron: `30 0 * * *`)
- Uses `firebase-admin` SDK with a service account to export all collections
- Backup stored as a GitHub Actions **artifact** (7-day retention)
- Can be triggered manually from the Actions tab

### Local (In-App)
- **Export**: Downloads all Firestore data as a `.json` file
- **Import**: Upload a `.json` file to restore all data (with confirmation)

---

## Getting Started

### Prerequisites

- **Node.js** 18.x or later
- **npm** 10.x or later
- **Angular CLI** 15.x (`npm install -g @angular/cli@15`)

### Installation

```bash
git clone https://github.com/JibinThomasM/KarateTracker.git
cd karate-tracker
npm install
```

### Development Server

```bash
ng serve
```

Navigate to `http://localhost:4200/`.

### First Run

1. Create a user account in **Firebase Console → Authentication → Add User**
2. Add the email to `allowedEmails` in `src/environments/environment.ts`
3. Open the app and log in
4. Go to **Settings** to configure:
   - Currency symbol
   - Default payment due day
   - WhatsApp message template
   - Add fee plans
   - Add dojos

---

## Build & Deployment

### Production Build

```bash
ng build --configuration production --base-href /KarateTracker/
```

### Deploy to GitHub Pages

```bash
npx angular-cli-ghpages --dir=dist/karate-tracker
```

### Setup GitHub Actions Backup

1. Go to Firebase Console → Project Settings → Service Accounts
2. Generate a new private key (JSON)
3. In GitHub repo → Settings → Secrets → Actions, add `FIREBASE_SERVICE_ACCOUNT_KEY` with the JSON contents
4. The workflow runs automatically daily; trigger manually from the Actions tab to test

---

## Security Recommendations

Add these Firestore rules in Firebase Console → Firestore → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null
        && request.auth.token.email in ['your-email@gmail.com'];
    }
  }
}
```

This ensures only authorized users can access data even if someone bypasses the client-side checks.

---

## Configuration

### Environment Files

| Setting | Description |
|---------|-------------|
| `firebase` | Firebase project config (apiKey, projectId, etc.) |
| `allowedEmails` | Array of emails authorized to log in |
| `production` | Production mode flag |

### In-App Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Currency | Currency symbol for payment display | ₹ |
| Default Due Day | Day of month for payment due dates | 5 |
| WhatsApp Template | Message template for payment reminders | — |

---

## License

Private — Indo-Japan Martial Arts Academy
