# Guesstora — Autonomous Multi-Outlet Cafe, Roastery & Restaurant SaaS

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![React Version](https://img.shields.io/badge/react-19.0-61dafb.svg)](https://react.dev/)
[![Express Version](https://img.shields.io/badge/express-5.1-black.svg)](https://expressjs.com/)
[![MySQL 8](https://img.shields.io/badge/mysql-8.0%2B-blue.svg)](https://www.mysql.com/)
[![Vite](https://img.shields.io/badge/vite-8.3-646CFF.svg)](https://vitejs.dev/)
[![Test Suites](https://img.shields.io/badge/tests-30%20suites%20passing-success.svg)](https://github.com/akashjha18/Guesstora)
[![Offline First](https://img.shields.io/badge/offline-IndexedDB%20Sync-orange.svg)](https://github.com/akashjha18/Guesstora)

**A high-performance, local-first commercial SaaS platform engineered for modern specialty coffee houses, roasteries, and restaurant chains.**

[Quick Start](#-quick-start) • [Portals & Apps](#-portals--applications) • [Core Modules](#-core-enterprise-modules) • [Architecture](#-architecture--tech-stack) • [Configuration](#-configuration--environment-variables) • [Testing](#-testing--quality-assurance) • [Production Ops](#-production-operations--deployment)

</div>

---

## ☕ Overview

**Guesstora** is an end-to-end cafe operating system built from the ground up to replace fragmented legacy point-of-sale systems with a unified, real-time, local-first SaaS architecture. 

From customer table QR ordering with milk/roast customizers to floor captain terminals, kitchen display stations, hardware ESC/POS thermal printer routing, Indian GST/Tally ERP export, roasting batch shrinkage tracking, role-weighted tip pools, and AI-driven BCG menu matrix intelligence, Guesstora handles every facet of food & beverage hospitality in a single codebase.

---

## 🚀 Portals & Applications

Guesstora provides 6 specialized, high-uptime web applications within a single unified frontend bundle:

```
                                      ┌─────────────────────────────────────────┐
                                      │           Guesstora Platform            │
                                      └────────────────────┬────────────────────┘
                     ┌──────────────────┬──────────────────┼──────────────────┬──────────────────┐
                     ▼                  ▼                  ▼                  ▼                  ▼
              📱 Customer App    🧑‍🍳 Captain App       📺 KDS App         🖥️ CFD App      🏢 Owner Portal
                `/c/:slug`          `/captain`           `/kds`             `/cfd`            `/owner`
                     │                  │                  │                  │                  │
               QR Menu Orders     Floor Terminal      Prep Display      Dual-Screen UPI    Command Center
               Mod customizer     PIN login           SLA timers        Live receipt       Analytics / GST
               Digital stamps     Course firing       Bump bar          Branded ambient    Staff Ops / AI
```

### 1. 📱 Customer Web App (`/c/:slug`)
* **Zero-Download QR Ordering:** Diners scan a table QR code and instantly browse rich menus with high-resolution imagery and allergen tags.
* **Granular Modifier Builder:** Customization modal supporting milk options (Oat, Almond, Whole), espresso roast choices, syrup pumps, and ice/temperature levels.
* **Smart Cart & Course Tagging:** Real-time bill calculations with integrated promo codes, dynamic table seating, and course classification.
* **Instant Payments:** Native checkout integration with **Razorpay**, **Stripe**, **Cash on Delivery**, and **Dynamic UPI QR**.
* **Live Order Journey Tracker:** Real-time Server-Sent Events (SSE) updates as the ticket moves from `Pending` → `Preparing` → `Ready` → `Served`.
* **Automated Review Booster:** Intercepts diner sentiment before checkout; 5-star diners are routed to Google Maps with pre-filled recommendations, while critical feedback routes privately to management.
* **Digital Loyalty Stamp Pass:** Interactive visual visit tracker where every completed order unlocks redeemable cafe perks and milestone rewards.

### 2. 🧑‍🍳 Floor Captain / Waiter POS (`/captain`)
* **Rapid PIN Access:** Fast 4-digit PIN authentication designed for floor staff on mobile or tablet devices.
* **Real-Time Table Matrix:** Color-coded floor map showing live occupancy (`Available`, `Occupied`, `Billing`, `Needs Attention`).
* **Course-Wise KOT Firing:** Send items to the kitchen in distinct stages (`Beverages`, `Starters`, `Mains`, `Desserts`) with a single tap.
* **Table & Bill Operations:** Transfer guests between tables, split bills (equally, by item, or custom amount), merge active tickets, and void items with manager audit tracking.
* **Offline Order Buffer:** Continues taking orders even during Wi-Fi packet drops, syncing automatically when connectivity returns.

### 3. 📺 Kitchen Display System (KDS) (`/kds`)
* **Multi-Station Ticket Routing:** Separate station filters for **Barista Bar** vs **Hot Kitchen** so stations see only their relevant orders.
* **Color-Coded SLA Timers:** Visual urgency indicators (Green `< 5m`, Amber `5–10m`, Red `> 10m` overdue) to maintain strict table service standards.
* **Auditory Chime Alerts:** Native audio alerts sound on new incoming tickets so kitchen staff never miss an order during peak rushes.
* **1-Tap Bump Bar:** Intuitive item bumping and ticket completion with undo capability.

### 4. 🖥️ Customer-Facing Display (CFD) (`/cfd`)
* **Dual-Screen Countertop Terminal:** Sits on counter tablets or secondary monitors facing the customer.
* **Live Cart Mirroring:** Synchronizes instantaneously with the cashier terminal, displaying line items, taxes, discounts, and item modifiers.
* **Dynamic UPI QR Code:** Generates real-time payment QRs encoded with exact order amounts for rapid scan-and-pay transactions.
* **Ambient Brand Idle Mode:** Renders high-resolution cafe brand assets, artisanal coffee imagery, and promotional slides when idle.

### 5. 🏢 Executive Owner & Management Command Center (`/owner`)
* **Unified Emerald & White Design System:** High-contrast, accessibility-tested SaaS layout with zero visual clutter.
* **Real-Time Venue Analytics:** Live revenue, active tables, hourly ticket velocity, average order value (AOV), and customer satisfaction scores.
* **Integrated Management Suites:** Access to all 7 deep-dive enterprise modules described below.

### 6. 🚀 Self-Service Onboarding Wizard (`/onboard`)
* **Rapid Multi-Step Provisioning:** New cafe owners set up establishment profile, currency, tax rates, floor tables, payment credentials, and starter menus in under 5 minutes.

---

## 💡 Core Enterprise Modules

### 🤖 1. AI Roastery Intelligence & Menu Engineering
* **BCG Growth-Share Matrix:** Categorizes every menu item into **Stars** (high volume, high margin), **Cash Cows** (high volume, low margin), **Puzzles** (low volume, high margin), and **Dogs** (low volume, low margin).
* **Price Elasticity Simulations:** Predictive model simulating estimated revenue and customer volume changes when altering menu pricing.
* **Hourly Rush Heatmaps:** Visual 24-hour kitchen load forecasts highlighting peak rush hours to optimize staff scheduling.
* **Market Basket Mining (Apriori Engine):** Analyzes transaction combinations to calculate item association confidence and power real-time cashier smart upsells.
* **RFM Guest Segmentation:** Automated customer grouping based on **Recency, Frequency, and Monetary** scores to trigger tailored retention discounts.

### 👥 2. Staff Operations & Role-Weighted Tip Payroll
* **Biometric Selfie Time Clock:** Staff clock in and out with camera snapshot capture and shift notes to prevent buddy-punching.
* **Shift Roster & Labor Budgeting:** Interactive weekly schedule planner with projected labor cost tracking against estimated sales.
* **Role-Weighted Tip Distribution Pool:** Automatically calculates and distributes collected tips across Baristas (e.g. 1.2x weight), Floor Captains (1.0x), and Kitchen Chefs (1.1x).
* **Waiter Performance Leaderboards:** Tracks upsell value, average table turn time, and customer feedback per staff member.

### 🧾 3. Indian GSTN Statutory Compliance & Tally Prime Sync
* **HSN/SAC Code Classification:** Pre-configured Table 12 classification (SAC `996331` for restaurant food, `996332` for beverages).
* **B2B vs B2C Invoicing:** Captures buyer GSTIN, business legal name, and state code with full reverse-charge mechanisms.
* **Inter-State Tax Ledgers:** Automatic bifurcation between intra-state (CGST + SGST) and inter-state (IGST) transactions.
* **One-Click Tally Prime XML Export:** Generates fully formatted XML import payloads compatible with Tally ERP 9 and Tally Prime for seamless accounting handoff.
* **Monthly GSTR-1 & GSTR-3B Summaries:** Instant tax liability and input credit reconciliation tables.

### 🖨️ 4. Hardware Hub & POS Peripherals
* **ESC/POS Network Printing:** Direct raw TCP socket printing to thermal printers (Epson, Star Micronics, TVS, Rongta) without third-party print drivers.
* **Multi-Station Printing Rules:** Automatically routes Barista items to Barista printers, Kitchen items to Kitchen printers, and Bill receipts to Cashier printers.
* **RJ11 Cash Drawer Kicks:** Sends standard hex kick pulses (`27, 112, 0, 25, 250`) on cash transactions or manager audits.
* **EDC Cloud Terminals & Weighing Scales:** Protocols for cloud-connected payment terminals (Pine Labs, Razorpay POS) and Bluetooth coffee dosing scales.

### 🏭 5. Central Commissary & Multi-Store Roastery Inventory
* **Green-to-Roasted Shrinkage Tracking:** Tracks batch roast moisture loss percentages (e.g., 15–18% standard bean shrinkage) to accurately calculate true cost per cup.
* **Inter-Outlet Stock Transfers (STN & GRN):** Tracks dispatch of coffee beans, syrups, and packaging with Goods Receipt Note variance detection.
* **Automated Reorder Points (ROP):** Calculates minimum safety stock levels and auto-generates supplier Purchase Orders (POs) when stock dips below thresholds.
* **Spoilage & Wastage Audits:** Granular financial loss logging with categorized reason codes (expired, burnt, dropped, calibration).

### 🌐 6. Omnichannel Aggregator & WhatsApp Network
* **Food Aggregator Connectors:** Webhook ingestion architecture for **Zomato** and **Swiggy** orders with a centralized live catalog toggle.
* **WhatsApp Cloud API Automation:** Dispatches real-time transactional alerts to diners (Order Confirmation, Kitchen Preparation, Out for Delivery, Loyalty Milestone Unlocked).
* **Multi-Outlet Chain Management:** Switch outlets seamlessly from a single dashboard with central menu master overrides.

### ⚡ 7. Local-First Offline Sync Engine
* **IndexedDB Client Storage:** Complete client-side database mirroring menus, tables, and orders.
* **Cryptographic Offline Queue:** Orders placed during internet outages are queued locally with SHA-256 signatures and timestamps.
* **Automatic Background Sync:** Background worker detects connection restoration, synchronizes queued transactions, and reconciles ID conflicts transparently.

---

## 🔐 Security & Architecture

* **Dual-Token Authentication:** 15-minute short-lived JWT access tokens paired with 30-day SHA-256 hashed refresh tokens stored in HTTP-only cookies.
* **Token Family Replay Protection:** If an expired or already-used refresh token is presented, the entire token family is immediately revoked to neutralize token theft attacks.
* **Role-Based Access Control (RBAC):** Strict permissions enforced across `Owner`, `Manager`, `Captain`, `Barista`, and `Kitchen` roles.
* **Per-IP Rate Limiting:** Brute-force protection on authentication, checkout, and webhook endpoints with `X-Forwarded-For` proxy hop safety.
* **Isolated Multi-Tenant Scoping:** Every database query is strictly scoped to the authenticated `cafeId` to guarantee absolute data isolation.
* **Audit Trail Logging:** Immutable security logs capturing manager overrides, bill re-openings, refunds, and manual discount applications.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite 8, React Router 7, Lucide Icons, QRCode.react, Vanilla CSS Design System |
| **Backend** | Node.js (ESM), Express 5, Sequelize ORM, Server-Sent Events (SSE), Morgan Logger |
| **Database** | MySQL 8.0+ / MariaDB 10.5+ (Strict SQL Mode, Transactions, Foreign Keys) |
| **Real-Time** | Server-Sent Events (SSE) with automatic keepalive pinging and client auto-reconnect |
| **Payments** | Razorpay, Stripe, Dynamic UPI QR Code, Cash Management |
| **Offline Storage**| IndexedDB, Service Worker caching, Local-first mutation queues |
| **Testing** | Node.js Test Runner (`node:test`), Playwright E2E browser automation |

---

## 📦 Quick Start

### Prerequisites
* **Node.js** `>= 20.0.0`
* **MySQL** `>= 8.0` (or MariaDB / XAMPP)
* **npm** `>= 10.0.0`

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/akashjha18/Guesstora.git
cd Guesstora

# Install root, server, and client dependencies in one command
npm install
npm install --prefix server
npm install --prefix client
```

### 2. Configure Environment Variables
Copy the template to `server/.env`:
```bash
cp .env.example server/.env
```

Edit `server/.env` with your MySQL credentials:
```env
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=cafe_loyalty

JWT_SECRET=super-secret-random-key-at-least-32-chars-long
PORT=5000
CLIENT_URL=http://localhost:5173
VITE_API_URL=http://localhost:5000/api
DEMO_PAYMENTS_ENABLED=true
```

### 3. Start Development Servers
```bash
npm run dev
```

* **Client:** `http://localhost:5173`
* **API Server:** `http://localhost:5000`

> **Note:** On first startup, Sequelize automatically executes `sequelize.sync()`, creates all relational tables, and seeds a ready-to-use demo cafe:
> * **Owner Portal:** `http://localhost:5173/owner/login`
> * **Default Credentials:** `owner@perkbyte.demo` / `Demo@123`
> * **Customer Menu:** `http://localhost:5173/c/demo-cafe`
> * **Captain POS:** `http://localhost:5173/captain/demo-cafe` (Default PIN: `1234`)
> * **Kitchen KDS:** `http://localhost:5173/kds/demo-cafe`
> * **Counter CFD:** `http://localhost:5173/cfd/demo-cafe`

---

## 🐳 Local Docker Development

A pre-configured Docker Compose file is included for instant local evaluation:

```bash
# 1. Prepare environment
cp .env.example server/.env

# 2. Spin up MySQL 8 and Guesstora application container
docker compose --env-file server/.env up --build
```

Access the application at `http://localhost:5173`.

---

## 🧪 Testing & Quality Assurance

Guesstora maintains a comprehensive test suite of **30 test suites** covering models, API routes, security controls, business engines, and browser end-to-end flows.

### Running Backend Integration Tests
The test runner creates an isolated, disposable MySQL database, executes all test suites, and safely tears down the database:

```bash
npm test
```

#### Test Suites Matrix:
* `aiRoastery.test.js` — BCG matrix math, price elasticity simulations, prep forecasting.
* `captain.test.js` & `captain-auth.test.js` — PIN auth, table matrix, course firing, bill splitting.
* `commissary.test.js` — Roastery batching, green-to-roasted shrinkage, STN/GRN receipts.
* `gst.test.js` — SAC codes, B2B tax calculation, Tally Prime XML schema validation.
* `hardware.test.js` — ESC/POS byte generator, printer station routing, cash drawer kicks.
* `offlineSync.test.js` — Timestamped sync queue reconciliation and conflict handling.
* `omnichannel.test.js` — Aggregator webhook ingestion and WhatsApp message templates.
* `staffOps.test.js` — Biometric selfie verification, shift rosters, tip pool distribution.
* `shifts.test.js` — Cash drawer float counting, day-end Z-reports, discrepancy audits.
* `payments.test.js` — Razorpay/Stripe webhook signatures, payment verification, idempotent settlement.
* `security.test.js` & `rbac.test.js` — JWT rotation, replay attacks, cross-tenant isolation guards.

### Running Browser E2E Tests
```bash
npm run test:browser
```

---

## 💾 Database Backup & Disaster Recovery

Guesstora includes zero-dependency, streaming AES-256-GCM encrypted database backup and authenticated recovery scripts:

### Create Encrypted Backup
```bash
export BACKUP_ENCRYPTION_KEY="your-base64-32-byte-key"
npm run db:backup --prefix server
```
* Generates an encrypted `.sql.enc` file in `server/backups/`.
* Uses `mysqldump` with `--single-transaction` for zero table locks.

### Authenticated Database Restore
```bash
export BACKUP_ENCRYPTION_KEY="your-base64-32-byte-key"
export BACKUP_FILE="server/backups/cafe_loyalty-2026-10-28T05-00-00.sql.enc"
export RESTORE_TARGET_DATABASE="cafe_loyalty_staging"
export RESTORE_CONFIRM_DATABASE="cafe_loyalty_staging"
npm run db:restore --prefix server
```
* Verifies the cryptographic authentication tag before importing.
* Refuses execution against the live production source database.

---

## 🌐 Production Operations & Deployment

### Production Build
```bash
npm run build --prefix client
```
Outputs optimized, tree-shaken static assets to `client/dist/`.

### Health & Readiness Probes
Configure your Kubernetes, AWS ECS, or Docker container health checks:
* **Liveness Probe:** `GET /api/health/live` (Returns HTTP 200)
* **Readiness Probe:** `GET /api/health/ready` (Returns HTTP 200 if MySQL is healthy; HTTP 503 if disconnected)

### Graceful Shutdown
The server listens for `SIGINT` and `SIGTERM` signals, closes active HTTP listeners, drains ongoing requests, and safely disconnects Sequelize connection pools.

### Production Environment Checklist
- [ ] Set `NODE_ENV=production`.
- [ ] Generate a cryptographically secure `JWT_SECRET` of at least 32 characters.
- [ ] Set `CLIENT_URL` to your exact production HTTPS origin (e.g., `https://pos.yourcafe.com`).
- [ ] Set `TRUST_PROXY_HOPS` to the exact number of upstream reverse proxies (e.g., Cloudflare + Nginx = `2`).
- [ ] Disable demo payments by leaving `DEMO_PAYMENTS_ENABLED=false`.
- [ ] Configure live `RAZORPAY_KEY_ID` & `RAZORPAY_WEBHOOK_SECRET` or `STRIPE_SECRET_KEY` & `STRIPE_WEBHOOK_SECRET`.

---

## 🗺️ Project Structure

```
gusstora/
├── client/                      # React 19 Frontend Application
│   ├── public/                  # Static assets & branded images
│   ├── src/
│   │   ├── components/          # Reusable enterprise managers
│   │   │   ├── AiRoasteryManager.jsx        # BCG matrix & menu elasticity
│   │   │   ├── BillOperationsModals.jsx     # Bill splitting & table merging
│   │   │   ├── CommissaryManager.jsx        # Roastery batches & store transfers
│   │   │   ├── GstTallyManager.jsx          # GST invoicing & Tally XML export
│   │   │   ├── HardwareManager.jsx          # ESC/POS printers & peripherals
│   │   │   ├── InventoryManager.jsx         # Raw ingredients & BOM recipes
│   │   │   ├── OfflineSyncModal.jsx         # Local-first sync controller
│   │   │   ├── OmnichannelManager.jsx       # Aggregators & WhatsApp Cloud
│   │   │   ├── ShiftModals.jsx              # Cash float & Z-reports
│   │   │   └── StaffOperationsManager.jsx   # Biometric clock & tip pools
│   │   ├── pages/               # Top-level portal applications
│   │   │   ├── CaptainApp.jsx               # Floor Waiter / Captain terminal
│   │   │   ├── CfdApp.jsx                   # Customer-Facing countertop display
│   │   │   ├── CustomerApp.jsx              # Diner QR ordering & loyalty pass
│   │   │   ├── KdsApp.jsx                   # Kitchen Display System
│   │   │   ├── Login.jsx                    # Multi-role authentication
│   │   │   ├── Onboard.jsx                  # Self-service cafe onboarding wizard
│   │   │   └── OwnerApp.jsx                 # Executive Management command center
│   │   ├── utils/               # Offline store & sync helpers
│   │   ├── styles.css           # Emerald & white SaaS design system tokens
│   │   └── main.jsx             # React Router configuration
│   └── vite.config.js
│
├── server/                      # Node.js / Express 5 API Server
│   ├── scripts/                 # Isolated test runner, backup & restore tools
│   ├── src/
│   │   ├── routes/              # Modularized Express route handlers
│   │   │   ├── aiRoastery.routes.js
│   │   │   ├── billOps.routes.js
│   │   │   ├── captain.routes.js
│   │   │   ├── commissary.routes.js
│   │   │   ├── gst.routes.js
│   │   │   ├── hardware.routes.js
│   │   │   ├── inventory.routes.js
│   │   │   ├── offlineSync.routes.js
│   │   │   ├── omnichannel.routes.js
│   │   │   ├── promos.routes.js
│   │   │   ├── shifts.routes.js
│   │   │   └── staffOps.routes.js
│   │   ├── aiRoasteryEngine.js  # BCG matrix & elasticity math algorithms
│   │   ├── auth.js              # Dual-token JWT rotation & replay protection
│   │   ├── commissaryEngine.js  # Batch roast shrinkage & STN/GRN ledger
│   │   ├── eventBus.js          # Multi-tenant Server-Sent Events (SSE) pipeline
│   │   ├── gstEngine.js         # Indian GST & Tally Prime XML generator
│   │   ├── hardwareEngine.js    # ESC/POS raw socket byte formatter
│   │   ├── models.js            # Sequelize relational schemas & associations
│   │   ├── payments.js          # Razorpay, Stripe, and UPI integrations
│   │   ├── staffOpsEngine.js    # Biometrics & role-weighted tip distribution
│   │   └── index.js             # Express server entry point & graceful shutdown
│   └── test/                    # 30 comprehensive integration & security test suites
│
├── .env.example                 # Comprehensive environment variable template
├── docker-compose.yml           # Local development container stack
└── package.json                 # Monorepo root scripts & orchestration
```

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <b>Built with precision for the next generation of independent roasters and multi-unit hospitality operators.</b>
</div>
