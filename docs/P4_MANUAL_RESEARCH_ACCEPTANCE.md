# P4 manual research acceptance checklist

This workflow is **research only**. It uses the untrained rule Brain and never sends live orders. It does not establish AI training, out-of-sample performance, or model promotion.

## One-time GitHub setup

1. Open repository Settings → Environments and create `p4-research`. Restrict deployments to `main` and optionally require an approving reviewer. The environment must exist before dispatch.
2. Add repository or `p4-research` environment Actions secrets named `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Copy them securely from your own Supabase configuration. Do **not** paste keys in chat, issues, code, workflow inputs, or logs.
3. Go to Actions → **P4 bounded research (manual only)** → Run workflow. Use `main` and a **new** job ID, e.g. `p4_btc_smoke_001`. Choose a historical UTC-aligned 1h window of 25–100 already closed candles. Supply Unix epoch milliseconds for first open, last open, and an `as_of_ms` strictly later than the last close. Start with **1 iteration**.
4. The workflow performs read-only schema preflight first, then invokes the bounded runner. The job requires both secrets and stops on failures. The runner is capped at 500 candles, 3 iterations and the workflow at 25 minutes.

## Verify acceptance

- GitHub workflow concludes SUCCESS, not merely queued or running.
- Supabase `public.p4_research_checkpoints` has exactly one row for the job, with phase `COMPLETED`, `completedIterations=1`, and expected loaded candles.
- Supabase `public.p4_research_rounds` has exactly one row for that job, iteration 1, matching the checkpoint fingerprint.
- `public.p4_research_leases` contains no **active** lease for that job after completion. An expired/released row is acceptable.
- Review the stored feedback as **untrained research baseline**, not actual autonomous learning. Do not infer annualized returns from this smoke run.

If a job fails, preserve its ID and inspect Actions logs and persisted checkpoint/rounds. Do not delete records or rerun with a different configuration under the same job ID. A stopped job may be resumed only with identical immutable job configuration.

The repository connector currently cannot verify GitHub Actions secrets, environment protection or dispatch this workflow. Those steps require a user with repository admin permissions. Do not claim end-to-end acceptance until actual persisted records have been inspected.
