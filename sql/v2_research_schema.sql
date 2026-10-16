-- V2 research schema draft. Not yet applied to Supabase.
-- Deliberately does not modify raw_candles, market_features or collector support tables.
create schema if not exists ai_v2;

create table if not exists ai_v2.research_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'PENDING' check (status in ('PENDING','RUNNING','SUCCEEDED','FAILED','CANCELLED')),
  symbol text not null,
  timeframe text not null check (timeframe in ('15m','1h','4h','1d')),
  horizon text not null check (horizon in ('INTRADAY','D1_3','WEEK','D15_30')),
  training_start timestamptz not null,
  training_end timestamptz not null,
  seed bigint not null,
  data_fingerprint text,
  code_revision text not null,
  config jsonb not null default '{}'::jsonb,
  metrics jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  check (training_end > training_start)
);

create table if not exists ai_v2.expert_versions (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('ENTRY','REWARD','WIN_PROBABILITY','RISK_POSITION','TIME','BRAIN','DIAGNOSTIC')),
  version text not null,
  artifact_uri text,
  artifact_hash text,
  training_run_id uuid references ai_v2.research_runs(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(role,version)
);

create table if not exists ai_v2.champions (
  role text primary key check (role in ('ENTRY','REWARD','WIN_PROBABILITY','RISK_POSITION','TIME','BRAIN','DIAGNOSTIC')),
  expert_version_id uuid not null references ai_v2.expert_versions(id),
  promoted_at timestamptz not null default now(),
  promotion_reason text not null
);

create table if not exists ai_v2.decisions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references ai_v2.research_runs(id) on delete cascade,
  symbol text not null,
  timeframe text not null,
  horizon text not null,
  decision_open_time bigint not null,
  action text not null check (action in ('APPROVE','RETURN','REJECT','WAIT')),
  direction text check (direction in ('LONG','SHORT')),
  entry_low numeric,
  entry_high numeric,
  stop_low numeric,
  stop_high numeric,
  take_profit_low numeric,
  take_profit_high numeric,
  proposed_fraction numeric check (proposed_fraction between 0 and 0.8),
  expert_outputs jsonb not null default '{}'::jsonb,
  brain_reason jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(run_id,symbol,timeframe,horizon,decision_open_time),
  check (entry_low is null or entry_high >= entry_low),
  check (stop_low is null or stop_high >= stop_low),
  check (take_profit_low is null or take_profit_high >= take_profit_low)
);

create table if not exists ai_v2.simulated_trades (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null unique references ai_v2.decisions(id) on delete cascade,
  entry_open_time bigint,
  exit_open_time bigint,
  fill_price numeric,
  exit_price numeric,
  position_size numeric,
  fee_paid numeric not null default 0,
  slippage_paid numeric not null default 0,
  net_pnl numeric,
  exit_reason text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (exit_open_time is null or entry_open_time is null or exit_open_time >= entry_open_time)
);

create table if not exists ai_v2.diagnostics (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references ai_v2.research_runs(id) on delete cascade,
  decision_id uuid references ai_v2.decisions(id) on delete cascade,
  responsible_role text check (responsible_role in ('ENTRY','REWARD','WIN_PROBABILITY','RISK_POSITION','TIME','BRAIN','DIAGNOSTIC')),
  diagnosis jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_v2_decisions_run_time on ai_v2.decisions(run_id,decision_open_time);
create index if not exists idx_ai_v2_runs_created on ai_v2.research_runs(created_at desc);

-- Security: ai_v2 is not added to the exposed Data API schemas.
-- Service-side access only until explicit auth/RLS design is reviewed.
