# eVEGAH Rider

Full-stack rider rental & operations app.

- **Frontend:** Vite + React + Tailwind
- **Backend:** Node + Express (`server/index.js`)
- **Database:** PostgreSQL (Dockerized for local dev)
- **Auth:** JWT + bcrypt against `public.users` (Firebase has been removed)

---

## Prerequisites

- Node.js **18+** and npm
- **Docker + Docker Compose** (for local Postgres)

---

## Quick start (first-time setup)

```bash
# 1. Install JS deps
npm install

# 2. Copy the env template to a real .env (required — gitignored)
cp .env.example .env
# Edit .env if needed (defaults already work for the docker compose Postgres).

# 3. Start the local Postgres container
docker compose -f docker-compose.postgres.yml up -d

# 4. (Optional) confirm the DB is up
docker ps --filter name=evegah_postgres

# 5. Start frontend + API together (auto-migrates + seeds on first boot)
npm run dev:full
```

> **If you see `Missing DATABASE_URL in environment` or `Missing JWT_SECRET`** —
> you skipped step 2. The repo ships `.env.example` (committed) which copies to
> `.env` (gitignored). The API loads `.env` first, then optionally
> `server/.env` and `server/.env.local` on top of it.

The frontend runs at `http://localhost:5174` and the API at `http://localhost:5050`.

### What happens on first boot

On startup the API:

1. Runs every SQL migration in `db/init/*.sql` in order if any required table is missing (`AUTO_MIGRATE=true`). This creates `riders`, `rentals`, `returns`, `battery_swaps`, `payment_*`, `users`, etc.
2. Seeds two default accounts into `public.users` **only if their email is missing** (idempotent — your password changes are never overwritten):

   | Role | Email | Password |
   | --- | --- | --- |
   | Admin | `adminev@gmail.com` | `admin123` |
   | Employee | `user@gmail.com` | `user@123` |

   Both can be customised via env vars (see below). **Change these credentials in the app after first login.**

Login at `http://localhost:5174/` — the same login page serves admin and employee; the role decides where you land.

---

## Environment variables

The repo ships **templates** that are committed:

- **`.env.example`** → copy to **`.env`** (required, gitignored). Read by Vite and the API.
- **`server/.env.example`** → copy to **`server/.env`** (optional, gitignored). API-only overrides.

Load order inside the API (later overrides earlier): `.env` → `server/.env` → `server/.env.local`. The frontend only reads `.env` (Vite limitation).

The most relevant keys:

```env
# Database
DATABASE_URL=postgresql://evegah:evegah@127.0.0.1:5432/evegah
AUTO_MIGRATE=true

# JWT
JWT_SECRET=<long-random-string>   # REQUIRED in production
JWT_EXPIRES_IN=8h

# Default seed users (idempotent — only inserted if email missing)
SEED_ADMIN_EMAIL=adminev@gmail.com
SEED_ADMIN_PASSWORD=admin123
SEED_EMPLOYEE_EMAIL=user@gmail.com
SEED_EMPLOYEE_PASSWORD=user@123
```

> The Postgres container in `docker-compose.postgres.yml` is configured with `user=evegah / password=evegah / db=evegah` on `5432`. If you change those, update `DATABASE_URL` in both `.env` files.

---

## Common scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite frontend only |
| `npm run dev:api` | API only with file-watch restart |
| `npm run dev:full` | Frontend + API together (recommended) |
| `npm run init:db` | Manually re-run all migrations against `DATABASE_URL` |
| `npm run lint` | ESLint |
| `npm run build` | Production build of the frontend |

---

## Adding more users

Two options:

1. **From the app** — log in as the seeded admin and create users from **Admin → Users**. This hits the JWT-protected `/api/admin/users` endpoints.
2. **By env** — change `SEED_EMPLOYEE_EMAIL` / `SEED_EMPLOYEE_PASSWORD` and restart the API. Because seeding is idempotent per email, an existing user is **never** modified — you'll need to delete the row (or change the email) for a new value to be applied.

---

## Database

- Schema lives in `db/init/` and is applied in numeric order:
  - `001_rider_drafts.sql`
  - `002_battery_swaps.sql`
  - `003_payment_dues.sql`
  - `004_core_rentals.sql`
  - `005_payment_notifications.sql`
  - `006_payment_transactions.sql`
  - `007_users.sql` — JWT auth users (replaces Firebase Authentication)
- To wipe and re-seed locally:

  ```bash
  docker compose -f docker-compose.postgres.yml down -v
  docker compose -f docker-compose.postgres.yml up -d
  ```

  Migrations + seed users will be reapplied on the next API boot.

---

## Firebase removal

Firebase Authentication and Firestore have been **fully removed**:

- All auth now goes through `POST /api/auth/login` (returns a JWT). Frontend stores the token via `src/utils/authSession.js`.
- User CRUD lives at `/api/admin/users[/:uid]` and writes to the Postgres `public.users` table.
- `src/config/firebase.js` was deleted; `firebase`/`firebase-admin` packages were removed from `package.json`.

If you're returning to the project after the migration, delete any local `node_modules/.firebase*` artefacts and run `npm install`.

---

## Optional integrations

### DigiLocker Aadhaar verification

Configured in `server/.env` (see the `DIGILOCKER_*` block). The redirect URL registered in APISetu must match `DIGILOCKER_REDIRECT_URI`. The backend exposes:

- `POST /api/digilocker/auth-url`
- `GET /api/digilocker/callback`
- `GET /api/digilocker/status`

For production, use HTTPS for the redirect URL.

### ICICI UPI payments

Toggle with `VITE_ICICI_ENABLED=true`. Keys and endpoints live in the `ICICI_*` block in `.env` / `server/.env`. The merchant public key path is `ICICI_PUBLIC_KEY_PATH`.

### WhatsApp Cloud API

For payment receipt delivery — `WHATSAPP_*` block in `.env`.

---

## Troubleshooting

- **`SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`** — the API can't read `DATABASE_URL`. Make sure `server/.env` exists and the password matches the docker container's `POSTGRES_PASSWORD`.
- **`ECONNREFUSED 127.0.0.1:5050`** — the API is not running. Start it with `npm run dev:api` or `npm run dev:full`.
- **Login returns "Invalid credentials"** — confirm the user row exists: `docker exec -it evegah-postgres psql -U evegah -d evegah -c "select email, role from public.users;"`. If empty, restart the API to trigger seeding.
- **Want to reset a forgotten admin password** — delete the row and restart the API to re-seed it:

  ```bash
  docker exec -it evegah-postgres psql -U evegah -d evegah \
    -c "delete from public.users where email = 'adminev@gmail.com';"
  ```
