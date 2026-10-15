# Autonomous AI Research Engine — implementation plan

## Goal
Build a self-operating research loop that acquires native market data, checks its integrity, trains horizon-specific AI models, evaluates genuine out-of-sample performance, compares generations, preserves reproducible evidence, and continues when new closed data becomes available. Routine model evaluation is a system responsibility, not a manual assistant review.

## Autonomous cycle
1. Collect closed native candles and derive point-in-time features.
2. Run automated integrity checks; quarantine affected series and record actionable errors.
3. Atomically claim a due research slot; prevent duplicate/concurrent generation runs.
4. Build chronological TRAIN / VALIDATION / untouched HOLDOUT partitions with embargo and no label leakage.
5. Train a bounded population of candidates, record parameters, code revision, data windows, and lineage.
6. Select candidates using TRAIN/VALIDATION only; independently evaluate the selected candidate once on HOLDOUT.
7. Compare to an appropriate champion on the same evaluation period. Do not tune repeatedly on the same holdout; require later FORWARD_PAPER evidence for promotion to a verified research champion.
8. Save returns, annualized returns, drawdown, win rate, trade count, fees, slippage, and uncertainty with explicit data-source labels. Missing evidence remains unavailable.
9. Keep the existing champion if the challenger is inferior or evidence is insufficient. Resume only on a fresh closed window, with bounded retries and backoff.

## Operational responsibilities
- System: data checks, scheduling, model training, candidate generation, evaluation, champion selection, audit logs, retry and pause-on-error.
- Assistant/developer: implement infrastructure, debug failures, maintain tests and improve algorithms.
- Dashboard: generation index, progress, model lineage, per-partition metrics, next scheduled cycle, WAIT reason, alerts, and failure recovery.

## Current implementation vs pending
- Implemented components: historical native candle and feature readers, supervised horizon training, validation-only 25-trial strategy batches, generation planning, validation-window checks, quality preflight, generation comparison, web monitoring components.
- Pending: fully automated scheduler with transactional claim and retries, independent holdout/forward evaluation protocol, durable model artifacts and registry, validated champion lifecycle, end-to-end autonomous cycle, and trustworthy performance dashboard.
- Existing validation-only results must not be represented as out-of-sample or realized performance.

## Acceptance criteria
1. New closed data triggers a single bounded research job without manual chat prompts.
2. Bad/missing data blocks training and records a recoverable failure.
3. Same-window and overlapping jobs cannot run concurrently.
4. Repeated evaluations cannot be used to optimize against the same holdout.
5. Generation and model lineage, metrics, and decisions are persisted and visible in the dashboard.
6. No new eligible model means KEEP/WAIT, not forced improvement.
7. A full cycle is demonstrated with actual stored inputs and independently verified output records.
