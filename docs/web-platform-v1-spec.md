# Web Platform v1 — implementation contract

Status: DESIGN ONLY. No database migration, authentication, UI, or runtime configuration has been deployed.

## Product boundaries

One web application with ADMIN and VIEWER roles. Historical research and paper trading only. No exchange trading credentials, live order execution, or real-money auto-trading endpoints.

## Screens and data contracts

1. Login: Supabase Auth session; default new user role VIEWER; ADMIN assigned only by trusted backend migration/operator.
2. Public dashboard: instrument status, latest market state, signal LONG/SHORT/WAIT with timestamp and explanation, verified model version, simulation status. Missing data must be shown as unavailable, never inferred.
3. Model performance: separate TRAIN / VALIDATION / HOLDOUT / FORWARD_PAPER; timeframe, sample size, fee/slippage, period return, annualized return, max drawdown, win rate, trade count, model version, evaluation window. Do not present historical results as live profits.
4. Admin instruments: allowlist of exchange/symbol/timeframes, enable/disable signal generation and training separately. Validate supported native data coverage before activation.
5. Admin training: frequency (hours), enabled, candidate budget, allowed training timeframes, min trades, experiment history, run-now, pause/resume. Display next due and last successful run.
6. Admin paper trading: isolated account balance and risk limits; cannot place real orders.
7. Admin system health: collector freshness, features lag, training runs, paper engine, notification status and errors.
8. Admin user access: VIEWER/ADMIN role management with audit trail; no self-promotion.

## Proposed database schema (new tables; names to verify against existing DB before migrations)

- app_user_roles(user_id uuid PK references auth.users, role text check ADMIN/VIEWER, created_at, updated_at)
- app_instruments(id uuid PK, exchange, symbol, market_type, enabled_for_training bool, enabled_for_signals bool, created_at, updated_at; unique exchange/symbol/market_type)
- app_training_settings(id uuid PK, instrument_id uuid FK, enabled bool, interval_minutes int, candidate_budget int, max_runtime_minutes int, updated_by uuid, updated_at; unique instrument_id)
- app_training_runs(id uuid PK, instrument_id FK, scheduled_at, started_at, finished_at, status, code_revision, model_version, configuration_snapshot jsonb, error_summary; unique instrument_id/scheduled_at)
- app_model_experiments(id uuid PK, run_id FK, strategy, timeframe, candidate_id, hyperparameters jsonb, partition, sample_count, trade_count, return_percent, annualized_return_percent, max_drawdown_percent, win_rate_percent, fee_rate, slippage_rate, evaluation_start, evaluation_end, eligible bool, selection_score, created_at)
- app_model_registry(id uuid PK, instrument_id FK, strategy, model_version, artifact_ref, state text check CANDIDATE/VALIDATED/REJECTED/ACTIVE, validation_run_id FK, approved_by uuid nullable, created_at)
- app_public_signals(id uuid PK, instrument_id FK, model_id FK, signal_time, timeframe, action text check LONG/SHORT/WAIT, explanation jsonb, published_at, created_at)
- app_admin_audit(id uuid PK, actor_user_id uuid, action, target_type, target_id, before jsonb, after jsonb, created_at)

## Authorization and execution

- Supabase RLS on every new public-schema table. VIEWER can SELECT only published signals, approved performance summaries and active instrument metadata via explicit views/policies; no direct access to settings, credentials, raw internal errors or private model artifacts.
- ADMIN can manage settings through authenticated server endpoints, which independently verify role and validate allowed fields. No service-role key in browser, no role assignment from client-controlled metadata.
- Railway worker reads app_training_settings and claims due jobs transactionally (one per instrument/scheduled slot). UI edits take effect on next schedule evaluation, without editing GitHub YAML. Failed jobs retry with bounded backoff and no overlapping training of same instrument.
- Current GitHub Actions schedule is temporary until Railway scheduler is deployed and verified. Disable one scheduler before enabling the other to prevent double runs.
- Each run stores immutable config snapshot, code revision, train/validation/holdout boundaries, experiment outcomes and artifacts. Candidate tuning uses TRAIN/VALIDATION only; untouched HOLDOUT for final evaluation. Repeated use of the same holdout for promotion is prohibited; forward paper evaluation required before ACTIVE.
- Any frequency or budget changes must respect server-side limits and resource quotas; never allow unbounded loops.
- Changes to risk limits, enabled instruments and schedule must be audit logged. No direct UI ability to modify collectors or delete market history.

## Acceptance gates

A. Role enforcement tested with viewer/admin and unauthenticated sessions.
B. Admin can change a training interval in UI; DB saves it; worker reads it; next_due changes; no GitHub edit needed.
C. User cannot read settings or unpublished experiment details.
D. Training and paper outputs carry clear data partition labels and timestamps.
E. No production collector interruptions and no real order routes.
F. No schema changes until existing Supabase tables and RLS policies are inspected and migration is reviewed.

## Implementation order

1. Inspect current Supabase schema/RLS and Railway service boundaries.
2. Migration and server-side role/auth tests.
3. Admin settings API + worker scheduling and audit log.
4. Responsive UI for admin and viewer.
5. Model registry, experiment leaderboard, public publication workflow.
6. Forward paper monitoring and notifications.

## UI visual design specification — approved direction

- Visual direction: dark-first, contemporary minimalist fintech dashboard. Shared design language across ADMIN and VIEWER experiences.
- Primary canvas #0B1018; surfaces #141D2A; raised/selected surface #172231; border #273448; primary text #F3F6FC; muted text #91A0B6; accent blue #67A9FF.
- Semantic profit/loss colors only when reflecting real positive/negative values. WAIT and neutral states must not look like trade recommendations. Never communicate performance by color alone.
- Typography: modern sans-serif, compact but readable; tabular numerals for prices, percentages and metrics. Minimum 14px body on desktop where feasible; adequate contrast and focus states.
- Layout: left navigation and compact top status bar on desktop; responsive navigation and single-column KPI cards on mobile. Spacious cards, subtle 1px borders, restrained rounded corners, no heavy gradients or decorative animations.
- Main admin areas: Overview, Instruments, Training, Experiments, Paper Trading, Market State, Signals, System Health, Settings, Users. Viewer navigation excludes administrative sections entirely.
- Distinguish TRAIN / VALIDATION / HOLDOUT / FORWARD_PAPER visually and textually. Every performance chart must show data source, evaluation dates, fees, sample size and whether values are simulated.
- Always-visible PAPER / NO REAL ORDERS environment indicator. No order-entry or real-funds controls in V1.
- Chart data must come from real stored metrics; sample charts and placeholder metrics must be visibly labeled as mock data.
- Accessibility: keyboard navigation, visible focus, text alternatives for status icons, responsive tables, WCAG AA contrast target.

## Authentication amendment — 2026-10-15

- Login UI uses **username + password**, not an email field. Initial administrator username: `guber`. Initial password is supplied privately by the owner at provisioning time; NEVER commit, log, seed in a public migration, or store it in plaintext.
- The username maps to a server-side identity; use Supabase Auth for secure password hashing, session management and refresh. An internal email identifier may exist as an implementation detail, but users never need to enter email.
- Implement username resolution and password verification on a protected server endpoint, with rate limiting, generic error messages, lockout/abuse controls, and TLS. Never expose username-to-email mappings or privileged Auth admin APIs in the browser.
- Bootstrap administrator via a one-time privileged provisioning step, not client-side signup or public SQL insertion. Username is unique and case-normalized. Restrict role assignment to trusted admin-only backend operations.
- Persist login through the supported Supabase Auth refresh-session mechanism; restore sessions after page refresh/browser restart. Sign out invalidates the local session; provide sign-out-all-sessions where supported.
- Password changes should go through Supabase Auth Admin APIs or a secure self-service flow, not direct edits to auth.users encrypted_password or plaintext database fields. Account display name and role can be updated separately with audited DB operations.
- Add tests for session restoration, expired/revoked sessions, rate limiting, and unauthorized ADMIN settings requests.
