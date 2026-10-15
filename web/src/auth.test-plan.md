# Authentication acceptance tests (pending execution)

## Session
- Username and password login works with a provisioned test account.
- Browser reload preserves a valid session.
- Browser restart preserves a valid refreshable session.
- Expired/revoked sessions return to login.
- Sign-out clears session.

## Authorization
- VIEWER cannot access admin-only pages through navigation or direct routes.
- VIEWER cannot read other users' role records.
- VIEWER cannot write any role, username or admin settings row.
- ADMIN server endpoints verify user identity and role independently of the UI.

## Abuse resistance
- Invalid username and wrong password have indistinguishable response bodies.
- Five attempts per username in 15 minutes allowed; sixth rejected.
- Per-IP limits and distributed attempt controls enforced before deployment.
- Credentials never appear in GitHub, logs, error reports, browser bundle or migration.

## Deployment gate
- Deploy function only after rate limiting, secure account bootstrap and actual end-to-end checks.
- Run frontend build and typecheck before release.
