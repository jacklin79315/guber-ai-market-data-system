# AI Trading Web

Private dark-mode dashboard, currently under development. PAPER only; no real-money trading.

## Simple login with Supabase Auth

No custom username-login API or extra authentication service is needed. The UI accepts a username and password and calls Supabase Auth using an internal email alias. Example: username `guber` with `VITE_AUTH_EMAIL_DOMAIN=accounts.example.com` maps to `guber@accounts.example.com`. This is only an identifier, not a required mailbox. **Use the exact same domain in the dashboard and when creating users.**

1. In Supabase Dashboard → Authentication → Users, use **Add user** to create `guber@accounts.example.com` (or your chosen domain) with a password; mark email confirmed if the dashboard offers that option. Do not enable public signup for this private application.
2. Copy `web/.env.example` to `web/.env.local` and fill in project URL, publishable key and the chosen email domain. Only the publishable key is safe for frontend use. Never put service-role keys in VITE variables.
3. In SQL Editor, look up the new Auth user ID and insert it into `public.app_user_roles` as ADMIN. Example (replace placeholder with actual user ID):

```sql
insert into public.app_user_roles(user_id, role)
values ('YOUR_AUTH_USER_UUID', 'ADMIN')
on conflict (user_id) do update set role = excluded.role;
```

4. Create friends' accounts in Auth Users with the same domain and distinct usernames. Without an ADMIN role record they default to VIEWER in the UI. Do not rely on frontend role display for backend permissions; every future admin write endpoint must check the role server-side.
5. The Supabase client persists and refreshes the login session by default; the user can log out from the UI. Admin password changes should use the Supabase Auth dashboard/API, not direct SQL updates to password hashes.

## Local preview

Requires Node.js 20+ and npm.

```bash
cd web
npm install
npm run dev
```

Build with `npm run build`.

## Current status

- Login code is committed, but no Auth user, deployed website or verified end-to-end login is available yet.
- Market data widgets are still placeholders; the collector and training workers are separate and untouched.
- The obsolete custom login function and bootstrap script have been removed from this branch. Unused legacy login-mapping/rate-limit tables remain in Supabase for now; they are not used by this frontend.
- Authentication does not authorize database writes. RLS and backend authorization remain mandatory for administrative actions.
