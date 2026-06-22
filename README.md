# Smart Market

Offline-first POS and inventory system built with React, TypeScript, Vite, RxDB/Dexie, PWA support, local backup with timestamps, license checks, and optional Groq AI assistance.

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Copy environment defaults:

```bash
copy .env.example .env.local
```

3. Run the app:

```bash
npm run dev
```

The app usually opens at `http://127.0.0.1:5173/`.

## Demo Access

Set this in local or Vercel environment variables:

```bash
VITE_ENABLE_DEMO_LOGIN=true
```

When enabled, the license screen shows one button: **Demo Login** / **الدخول التجريبي**.

For production, set:

```bash
VITE_ENABLE_DEMO_LOGIN=false
```

## Required Environment Variables

Client-side:

- `VITE_ENABLE_DEMO_LOGIN`: shows or hides the temporary demo login button.

Server-side Vercel API:

- `GROQ_API_KEY`: developer Groq key used by `/api/ai-chat`.
- `ADMIN_SECRET`: password for admin license creation.
- `GITHUB_PAT`: GitHub token that can read/write the license repository file.
- `GITHUB_REPO_OWNER`: GitHub owner or organization.
- `GITHUB_REPO_NAME`: repository that contains `licenses.json`.

## Quality Checks

```bash
npm run lint
npm run build
```

## Vercel

Use these defaults:

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- API directory: `api`

Add all environment variables in Vercel Project Settings before deploying.
