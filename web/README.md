# AI Trading Web — frontend scaffold

Responsive dark-mode React/TypeScript dashboard. UI preview only; no credentials, backend API, authentication, order execution or deployment is configured.

## Local preview

Requires Node.js 20+ and npm.

```bash
cd web
npm install
npm run dev
```

Build with `npm run build`.

## Safety and status

- All overview values are clearly identified as existing configuration or static UI placeholders, not live data.
- No trading API or exchange secrets in browser.
- No backend connectivity or authorization until Supabase Auth + RLS and server-side APIs are implemented and tested.
- Sidebar navigation changes the heading only. Functional pages are not yet implemented.
- This directory is isolated from the existing Python collector and training workers.

See `docs/web-platform-v1-spec.md` for the approved information architecture, roles, data contract and acceptance gates.
