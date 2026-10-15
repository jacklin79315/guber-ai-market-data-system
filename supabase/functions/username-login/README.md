# Username login Edge Function (NOT DEPLOYED)

Accepts username/password via HTTPS POST and returns Supabase Auth access/refresh tokens. Browser stores the session through supabase-js persistent-session support. Username is resolved server-side using a service role and private mapping table; the user never types an email.

**Do not deploy yet.** Must add server-enforced per-IP and per-username rate limits (persistent across function instances), abuse alerting, HTTPS origin allowlist, integration tests, and secure admin provisioning first. CORS alone is not an authentication or abuse defense.

Provision the initial administrator with the username `guber` through a one-time trusted server-side operation. Enter the owner-provided password only through a secure secret input; never commit it to Git, SQL migrations, CI logs, or browser source. Auth creates the password hash; insert the returned auth user id into app_usernames and app_user_roles as ADMIN using privileged backend credentials. Do not update auth.users encrypted_password directly.

Environment: ALLOWED_WEB_ORIGIN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY. The service-role key must remain server-side.
