# @tcp/api — Trade Copier Platform API

NestJS + Prisma + PostgreSQL backend. **Phase 1** implemented: auth, RBAC, super-admin
seeding, admin management, audit log.

## Prerequisites

- Node.js ≥ 20, pnpm
- PostgreSQL running locally (or via `docker compose up -d postgres` from repo root)
- Root `.env` present (see `.env.example`); `apps/api/.env` is a symlink to it

## First-time setup

```bash
pnpm install                       # from repo root
cd apps/api
pnpm prisma migrate dev            # apply migrations
pnpm build                         # compile
```

## Run

```bash
pnpm start:dev                     # watch mode (http://localhost:3000/api/v1)
# or
pnpm build && node dist/main.js
```

On first boot the app **seeds the Super Admin** from `SUPER_ADMIN_EMAIL` /
`SUPER_ADMIN_PASSWORD` (idempotent — skipped if one already exists).
You can also seed manually: `pnpm seed`.

## Endpoints (Phase 1)

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| POST | `/api/v1/auth/login` | public | email + password → access + refresh tokens |
| POST | `/api/v1/auth/refresh` | public | rotate tokens |
| POST | `/api/v1/auth/logout` | auth | revoke refresh token |
| GET | `/api/v1/auth/me` | auth | current user |
| POST | `/api/v1/admins` | SUPER_ADMIN | create admin |
| GET | `/api/v1/admins` | SUPER_ADMIN | list admins |
| GET | `/api/v1/admins/:id` | SUPER_ADMIN | admin detail |
| PATCH | `/api/v1/admins/:id` | SUPER_ADMIN | enable/disable |
| POST | `/api/v1/admins/:id/reset-password` | SUPER_ADMIN | reset password |
| POST | `/api/v1/masters` | auth | add master (≤2), provisions + creates strategy |
| GET | `/api/v1/masters` | auth | list masters (with slave counts) |
| GET | `/api/v1/masters/:id` | auth | master detail |
| PATCH | `/api/v1/masters/:id` | auth | rename |
| POST | `/api/v1/masters/:id/connect` \| `/disconnect` | auth | connection state |
| POST | `/api/v1/masters/:id/close-all` | auth | emergency close (master + slaves) |
| DELETE | `/api/v1/masters/:id` | auth | remove (cascades slaves) |
| POST | `/api/v1/masters/:id/slaves` | auth | add slave (≤10/master) + rules |
| GET | `/api/v1/masters/:id/slaves` | auth | list slaves |
| GET | `/api/v1/slaves/:id` | auth | slave detail |
| PATCH | `/api/v1/slaves/:id` | auth | update rules (sizing, SL/TP, reverse, symbol map) |
| POST | `/api/v1/slaves/:id/pause` \| `/resume` | auth | toggle copying |
| DELETE | `/api/v1/slaves/:id` | auth | remove slave |
| GET | `/api/v1/masters/:id/copy-events` | auth | copy log for a master (`?from&to&limit`) |
| GET | `/api/v1/slaves/:id/copy-events` | auth | copy log for a slave |
| GET | `/api/v1/accounts/:id/snapshot` | auth | latest balance/equity snapshot |
| POST | `/api/v1/dev/simulate/masters/:id/open` | auth (dev) | simulate a master trade → fan out to slaves |
| POST | `/api/v1/dev/simulate/masters/:id/close` | auth (dev) | simulate closing a master trade |

### Live stream (WebSocket)

Socket.IO namespace **`/stream`**. Authenticate with the JWT access token in the
handshake (`auth: { token }`). Then `emit('subscribe', { room: 'master'|'slave', id })`
and receive:

| Event | When |
|-------|------|
| `copy_event` | a trade is copied/closed/modified (per master + slave room) |
| `account_snapshot` | balance/equity update for an account |

The dev `simulate` endpoints (disabled when `METAAPI_TOKEN` is set) drive this pipeline
without a broker so monitoring is verifiable locally. In production the real
`MetaApiCopierProvider` CopyFactory listeners feed the same `MonitoringService`.

### Copier provider

Master/slave operations route through a `CopierProvider`:
- **MockCopierProvider** (default when `METAAPI_TOKEN` is empty) — no external calls; used for local dev + the verified Phase 2 flow.
- **MetaApiCopierProvider** (when `METAAPI_TOKEN` is set) — real MetaApi + CopyFactory; integration skeleton to be wired + verified during the Phase 0 spike.

Broker passwords are AES-256-GCM encrypted at rest (`CRYPTO`/`CryptoService`) and forwarded to the provider; the plaintext is never persisted.

## Quick smoke test

```bash
BASE=http://localhost:3000/api/v1
curl -s -X POST $BASE/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"contactsanket1@gmail.com","password":"<your SUPER_ADMIN_PASSWORD>"}'
```

## Security notes

- Passwords hashed with **argon2id**; refresh tokens stored as argon2 hashes (rotated per use).
- Disabling an admin (or resetting their password) immediately revokes their session.
- `.env` and `Server/` are gitignored — never commit secrets.

## Next (Phase 2)

MetaApi + CopyFactory: `MasterAccount` / `SlaveAccount` models, provisioning, and the
copy engine wiring. See [../../docs/05-implementation-plan.md](../../docs/05-implementation-plan.md).
