# HUA 3D Analytics Worker

Cloudflare Worker + D1 backend for anonymous HUA 3D Showcase analytics.

## Setup

```bash
cd analytics-worker
npm install
npx wrangler login
```

This project is configured to use the existing D1 database:

- Database name: `3dhua-analytics-db`
- Database ID: `1aa544f0-1c2e-41a3-82ec-dfaf762e3bdb`

Do not create a new D1 database unless you intentionally want to migrate to a new analytics store.

Set private secrets:

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put ADMIN_TOKEN_SECRET
```

`ADMIN_TOKEN_SECRET` can be any long random string. It is used to sign short-lived admin tokens.

Update `ALLOWED_ORIGINS` in `wrangler.toml` if you add a custom GitHub Pages domain or another local dev origin.

Run migrations:

```bash
npx wrangler d1 migrations apply 3dhua-analytics-db --remote
```

Deploy:

```bash
npx wrangler deploy
```

## Frontend Endpoint

The frontend endpoint in `analytics/client.js` is currently:

```js
https://3dhua-analytics.peterkoutroulis2004.workers.dev/track
```

with the deployed Worker `/track` URL.

## Local Development

```bash
npm run dev
npm run db:migrate:local
```

For local Worker testing, create a local `.dev.vars` file with secrets. Do not commit it:

```text
ADMIN_PASSWORD=replace-me
ADMIN_TOKEN_SECRET=replace-me-too
```

## Endpoints

- `POST /track` accepts anonymous analytics events from the showcase.
- `POST /admin/login` checks `ADMIN_PASSWORD` and returns a short-lived signed token.
- `GET /admin/stats` returns aggregate visitors, sessions, page views, scenes, devices, locations, referrers, and failures.
- `GET /admin/sessions` returns recent sessions and live active-session count.
- `GET /admin/errors` returns recent errors.
- `GET /admin/visitor/:visitor_id` returns admin-only detail for one anonymous visitor.
- `POST /admin/visitor-label` creates or updates a private admin label/note for one anonymous visitor.
- `DELETE /admin/visitor-label` removes a private admin label/note.

No exact IP addresses are stored. Country/city/region/colo are read from Cloudflare request metadata when available.
Visitor labels are private admin metadata and are not exposed through public tracking endpoints.
