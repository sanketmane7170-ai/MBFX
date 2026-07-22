# @tcp/web — Trade Copier Platform (Frontend)

Vite + React + TypeScript + Tailwind (shadcn-style structure). **Phase 4 start**:
landing/hero page and login (wired to the real API), plus a protected dashboard shell.

## Run

The backend must be running first (`cd apps/api && pnpm start:dev` on :3000).

```bash
pnpm --filter @tcp/web dev     # or: pnpm web:dev  (from repo root)
# → http://localhost:5173
```

Vite proxies `/api` and `/stream` to the backend on :3000 (see `vite.config.ts`),
so the app calls same-origin `/api/v1/...`.

## Pages / routes

| Route | Page | Notes |
|-------|------|-------|
| `/` | Landing / hero | Product hero + feature cards (from `frontPage.md`, adapted to Vite) |
| `/login` | Login | Animated split-card (from `LoginPage.md`), wired to `POST /auth/login` |
| `/dashboard` | Dashboard shell | Protected (redirects to `/login` without a token); full UI = later in Phase 4 |

## Structure

```
src/
├── main.tsx, App.tsx            # entry + routing (react-router)
├── index.css                    # Tailwind + CSS variables
├── lib/
│   ├── utils.ts                 # cn()
│   └── api.ts                   # login / token storage / fetchMe
├── components/ui/
│   ├── progressive-blur.tsx     # from spec
│   └── timeline-animation.tsx   # TimelineContent (implemented; was a missing dep)
└── pages/
    ├── LandingPage.tsx          # hero
    ├── LoginPage.tsx            # sign-in (animated dot-map canvas)
    └── DashboardPage.tsx        # protected placeholder
```

## Adaptations from the source specs

- Specs were **Next.js + shadcn**; this app is **Vite + React**, so `next/link`→`react-router`,
  `next/image`→gradient feature cards, `"use client"` removed.
- The missing `TimelineContent` dependency was **implemented** (`components/ui/timeline-animation.tsx`).
- Standardized on `framer-motion` (spec mixed `framer-motion` + `motion/react`).
- Login **Google button removed** (no OAuth backend) and the form **wired to the real
  `/auth/login`** with loading + error states; template "Travel Connect" branding replaced.

## Verified

`pnpm build` (tsc + vite) passes; live: page serves, and login proxies through to the
backend (correct creds → SUPER_ADMIN token; wrong creds → 401).
