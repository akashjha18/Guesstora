# Guesstora — Cafe Ordering & Loyalty SaaS

A runnable React + Node/Express + MySQL application for QR menus, ordering, table bookings, configurable loyalty visits, rewards and an owner dashboard.

## Quick start

1. Install MySQL locally (or use XAMPP/MariaDB) and create an empty database, e.g. `cafe_loyalty`.
2. Copy `.env.example` to `server/.env` and set the `MYSQL_*` vars and `JWT_SECRET`. Alternatively, set `MYSQL_URL` to a `mysql://user:password@host:port/database` URL and remove or comment out `MYSQL_DATABASE` from `server/.env`; the database name is taken from the URL path, and its credentials must be allowed to create that database.
3. Run:

```bash
npm install
npm install --prefix server
npm install --prefix client
npm run dev
```

Tables are created automatically on first server start (via `sequelize.sync()`), and a demo cafe + owner account are seeded. Open `http://localhost:5173`. Demo owner login is `owner@perkbyte.demo` / `Demo@123`.

### Local Docker development

The supplied Compose stack is for local development only; it mounts source code and runs the Vite development server. Do not deploy it as a production stack. After copying `.env.example` to `server/.env`, set a local `MYSQL_PASSWORD` and `JWT_SECRET`, then run `docker compose --env-file server/.env up`.

## Testing

Run `npm test` from the project root. The test runner requires a local MySQL server, creates a uniquely named disposable database for the backend suite and API smoke test, and drops those databases afterward. It uses the MySQL connection values in `server/.env`; set `TEST_MYSQL_HOST`, `TEST_MYSQL_PORT`, `TEST_MYSQL_USER`, or `TEST_MYSQL_PASSWORD` to override them. For safety, the isolated test runner only permits a loopback MySQL host.

The end-to-end suite also starts an isolated API in production mode to rehearse production startup, HTTPS CORS, disabled demo seeding, registration/menu/order flow, and demo-payment rejection. This is not a substitute for running the checklist below against a deployed staging environment.

## Production operations

Build the frontend with `npm run build`, deploy `client/dist` to static hosting, and deploy `server` to a managed Node host or VPS. Set `NODE_ENV=production` and `VITE_API_URL` to the public API URL before building. Use HTTPS and configure `CLIENT_URL` as one or more comma-separated HTTPS origins without paths, a randomly generated `JWT_SECRET` of at least 32 characters, and the provider credentials and webhook secrets for each enabled online payment gateway. Use a dedicated MySQL application account with only the required database privileges; do not use the root account in production. Never commit or expose production secrets.

### Health, logs, and shutdown

- Configure the platform's liveness probe to `GET /api/health/live` and readiness probe to `GET /api/health/ready`. Readiness returns HTTP 503 when MySQL cannot be reached.
- The API handles `SIGINT` and `SIGTERM`, stops accepting new HTTP requests, drains active requests, and closes Sequelize connections. The host should allow at least 10 seconds before forcefully terminating the process.
- Send application stdout/stderr to the host's centralized log service. Alert on repeated readiness failures, API restarts, elevated 5xx responses, and database connection/storage exhaustion. The API does not include a metrics exporter or error-reporting integration; configure those in the hosting platform before a paid launch.
- Login and order limits are applied per client IP and held in process memory. Set `TRUST_PROXY_HOPS` to the exact number of trusted reverse proxies in front of the API; leave it at `0` when directly exposed. Run a single API instance unless rate limiting and real-time event delivery are moved to shared infrastructure, because their current state does not coordinate across replicas.

### Database backup and recovery

- Enable automated, encrypted MySQL backups with a retention period appropriate to your business and provider. Restrict backup access separately from application credentials.
- Install the MySQL client utilities (`mysqldump` and `mysql`) on the controlled backup/restore runner. Set `BACKUP_ENCRYPTION_KEY` to a separately managed base64-encoded 32-byte key, then run `npm run db:backup --prefix server`. Backups are AES-256-GCM encrypted while streaming to `BACKUP_DIR` (default `server/backups`); the key is not written to the backup or command arguments. Keep the key in a secrets manager and store/replicate backup files in encrypted, access-restricted off-host storage. Configure retention and alert on missed scheduled runs; the command itself is an on-demand backup, not a scheduler.
- To test recovery, create an empty target database on a local MySQL server. Set `BACKUP_FILE`, `RESTORE_TARGET_DATABASE`, and `RESTORE_CONFIRM_DATABASE` (the latter two must exactly match), then run `npm run db:restore --prefix server`. The restore utility verifies the complete backup authentication tag before import, refuses the configured source database, and refuses targets that already contain tables. Remote restore is blocked unless `RESTORE_ALLOW_REMOTE_HOST=true` is explicitly set. Only restore into a disposable, verified target.
- After restore, run the application against the restored database and verify readiness and representative records. Record backup age, restore duration, and outcome; periodically test this process before relying on backups.
- Apply schema migrations and verify readiness during rollout. Keep the prior application release available for rollback; database changes must remain compatible with that release.

### Staging acceptance before launch

Run these checks against a deployed staging environment with production-like configuration, a disposable database, and payment-provider sandbox credentials:

1. Confirm HTTPS frontend/API URLs, production CORS, health/readiness probes, and that demo accounts/payments are disabled.
2. Register a test café, sign in as its owner, load the public menu, and place a cash order. Verify it appears in the owner dashboard and kitchen/order views.
3. Exercise a sandbox checkout and its signed webhook; verify a successful payment settles only the matching order once, and rejected/invalid signatures, amount, currency, provider reference, or duplicate events cannot incorrectly settle another order.
4. Verify a user from one café cannot read or mutate another café's data; test key owner/staff workflows and browser console/network errors.
5. Restart the API and database, verify readiness and persisted orders, and confirm automated backup plus a restore into a separate staging database.
6. Observe logs, error rates, database capacity, and host alerts during the run. Record the release identifier, test outcome, rollback target, and outstanding issues before production approval.

This repository run can exercise isolated local databases, but it cannot certify a live staging deployment, provider sandbox delivery, browser-based acceptance, or backup restoration.

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

Razorpay and Stripe checkout require real provider credentials (`RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` or `STRIPE_SECRET_KEY`/`STRIPE_PUBLISHABLE_KEY`) and configured webhook signing secrets (`RAZORPAY_WEBHOOK_SECRET` or `STRIPE_WEBHOOK_SECRET`). Payment confirmation is checked with the provider API, and webhook events must have a valid signature and match the pending order's provider reference, amount, and currency. UPI links do not provide server-verifiable settlement and cannot mark an order paid. Demo accounts are not seeded in production; `demo_online` is available only outside production when `DEMO_PAYMENTS_ENABLED=true`.
