# pp-dashboard

Admin/dev dashboard for PadhaiPal. Next.js 16, Tailwind, NextAuth.

## Env vars

| Variable | Description |
|---|---|
| `NEXTAUTH_SECRET` | Random secret for JWT signing |
| `NEXTAUTH_URL` | Public URL (`https://dashboard.padhaipal.com`) |
| `PP_SKETCH_INTERNAL_URL` | pp-sketch internal URL via Railway private networking |

## Deploy (Railway)

1. Set env vars above in Railway service settings.
2. Build command: `npm run build`
3. Start command: `npm run start`
4. Custom domain: `dashboard.padhaipal.com`

## First-time setup

1. In pp-sketch, run `npm run seed` to create bootstrap dev user (`919000000000` / `admin123`).
2. Log in to dashboard with those creds.
3. Use Swagger UI to promote real users via `PATCH /users/:id/role`.
4. Delete the seed user via `DELETE /users/:id`.

## Pages

- `/login` — phone + password
- `/dashboard` — admin + dev
- `/swagger` — dev only, embedded Swagger UI pointing at pp-sketch
