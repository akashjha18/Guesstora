# Guesstora — Cafe Ordering & Loyalty SaaS

A runnable React + Node/Express + MySQL application for QR menus, ordering, table bookings, configurable loyalty visits, rewards and an owner dashboard.

## Quick start

1. Install MySQL locally (or use XAMPP/MariaDB) and create an empty database, e.g. `cafe_loyalty`.
2. Copy `.env.example` to `server/.env` and set the `MYSQL_*` vars (or `MYSQL_URL`) and `JWT_SECRET`.
3. Run:

```bash
npm install
npm install --prefix server
npm install --prefix client
npm run dev
```

Tables are created automatically on first server start (via `sequelize.sync()`), and a demo cafe + owner account are seeded. Open `http://localhost:5173`. Demo owner login is `owner@perkbyte.demo` / `Demo@123`.

### One-command Docker start

If Docker is installed, run `docker compose up`. This starts MySQL, the API, and the React app together. Change the JWT secret and DB password before production.

## Production

Build the frontend with `npm run build`, deploy `client/dist` to static hosting, deploy `server` to your VPS, and set `VITE_API_URL` to the public API URL before building. Use HTTPS. Replace the demo payment adapter with Razorpay or Stripe webhooks before accepting online payments.

## Core flows

- Customer opens `/c/demo-cafe` from a table QR.
- Customer browses menu, adds items, enters mobile/name, and places an order.
- A paid/completed eligible order earns one loyalty visit.
- At the configured threshold, a reward is unlocked and may be redeemed on a future order, up to the owner-defined cap.
- Owner manages products, order status, bookings, and loyalty policy.

## API highlights

- `POST /api/auth/login`
- `GET /api/public/cafes/:slug`
- `POST /api/public/cafes/:slug/orders`
- `POST /api/public/cafes/:slug/bookings`
- `GET /api/public/cafes/:slug/loyalty/:phone`
- `GET/PATCH /api/owner/*` (JWT protected)

Online payment is intentionally a provider-ready adapter; the included `demo_online` method marks payment paid for demonstration only.
