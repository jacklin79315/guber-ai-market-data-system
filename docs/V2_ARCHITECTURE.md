# AI Trading System V2 — Architecture Contract

Status: architecture baseline; not a claim that AI training or trading is deployed.

## Protected market-data layer
- Preserve existing `raw_candles` and `market_features` data and tables.
- Preserve `market_data_watchlist`, `ingestion_jobs`, and `data_quality_issues` while the native collector depends on them.
- Keep `collector.py`, `feature_engine.py`, `worker.py`, `Procfile`, `requirements.txt`.
- Native Binance Spot closed K-lines only; independent 15m, 1h, 4h, 1d intervals; no synthetic 5m aggregation.
- Ingestion/feature computation are separate from AI decision-making. No mutation of raw candles for training.

## Advisory and workflow boundary
The live system delivers a one-time advisory proposal; user chooses whether to trade. It does not place orders or monitor the user's actual holdings. Historical simulations still track simulated positions for evaluation. Specialist workflow: Entry → Reward → Win Probability / Time → Risk/Position → Brain. Each review can PASS, RETURN, or REJECT. RETURN goes to the original specialist; downstream specialists cannot mutate upstream outputs. Preserve revision and rationale history. Brain may select best one, up to two, or WAIT. Time specialist does not bear direct profit/loss blame.

## V2 AI roles
Five independent specialists:
1. Entry: propose entry price range and directional candidate.
2. Reward: owns both take-profit (TP) and stop-loss (SL) ranges, and expected reward/risk.
3. Win Probability: estimate calibrated probability with uncertainty using proposed entry, TP/SL and time assumptions; assess the share and severity of losing trades, not win rate alone.
4. Risk/Position: position sizing, exposure and loss budgeting based on Reward's TP/SL; may RETURN for revision but cannot overwrite Reward's SL.
5. Time: estimate holding duration; cannot veto a trade.

Brain adjudicator: APPROVE, RETURN, REJECT, WAIT, with attributable rationale. Diagnostic AI evaluates completed simulations and attributes errors to the responsible specialist. Each specialist may have independently promoted champion/challenger versions. No legacy 0–100 trade scoring.

## Holding horizon and capital model — revised decision
The four fixed strategies and four capital pools have been **completely removed**. Do not revive them as execution modes, mandatory classifications, or funding ledgers. Shared specialists determine each proposal's time horizon dynamically. Use one 10,000-unit initial simulated account (currency unit pending explicit confirmation); Risk/Position manages allocation and exposure. No leverage; no automated real-money order placement.

## Simulation invariants
- Decisions only use information available at decision time.
- Decision candle cannot fill; earliest fill is the next candle.
- If take-profit or stop-loss is touched before a pending entry fills, cancel that pending entry.
- No arbitrary expiration of an unfilled entry.
- If both TP and SL touch on the same candle, use whichever is closer to candle close; exact tie is SL.
- Same symbol, same timeframe: approved open entry ranges must not overlap. Different timeframes remain independent.
- Model trading costs: spot fees and slippage.
- Support LONG, SHORT, WAIT in research; short execution must not be represented as executable spot trading without borrow/margin.

## Diagnostic learning
Independent diagnostic AI examines immutable specialist predictions and completed simulated outcomes before assessing expert quality. Assign primary/secondary/shared causality with evidence; do not penalize statistically reasonable losses by default. Diagnostic AI itself is evaluated and can learn. No fixed Brain 0–100 decision score. Retain specialist/model quantitative evaluation and diagnostic scoring; annualized return, win rate, and expert diagnostics are observational/evaluation metrics, not a user-approved fixed ranking formula. Exact specialist score formulas are not yet verified. Measure predictive calibration, fill quality, risk, opportunity costs and portfolio outcomes. Avoid both indiscriminate WAIT and forced trades.

## Training and evaluation
- Simulate chronological 24-month histories; iterative challenger research up to 100 rounds, not 100 independent identical replays.
- Keep causal data separation and out-of-sample assessment without an arbitrary 30-day embargo.
- Evaluate net profit, annualized return, maximum drawdown, win rate, payoff ratio, trade count, and per-horizon outcomes.
- Do not select models using a fixed minimum win-rate or annual-return threshold; compare candidate results after evaluation.
- Require reproducible seeds, data/version lineage, run logs, and explicit promotion decisions.

## Delivery sequence
1. Protect and validate the market-data layer, and build the authenticated, operational frontend control center **before implementing experts and Brain**.
2. Implement typed market-data adapter and chronological simulator.
3. Implement five expert contracts, Brain, WAIT, and diagnostic attribution.
4. Implement iterative challenger training and objective evaluation.
5. Extend the already deployed frontend with training, diagnostics, performance and version controls.

No real-money auto-ordering feature is in scope.

## Frontend control plane
Admin login/password and server-enforced authorization for changes to trading pairs, parameters, manual training and future LINE notification toggles. Separate persistent admin identity/roles, settings, training requests, notification settings, audit events, UI preferences. Existing market_data_watchlist remains the authoritative collection list. No direct browser access to service secrets and no frontend mutation of raw_candles. Display unavailable AI controls as disabled until actual backend support exists.

## Explicitly retired criteria
No annualized return >=10%, win rate >=70%, or score >65 gating. The current architecture is specialists + Brain + independent diagnostics and learning; there are no four predefined strategy tracks or corresponding capital pools.

## Current user decisions superseding prior scoring language
Legacy scoring scheme is entirely removed: no Brain 0–100 points, no historical win/loss/return point scheme, no 10% annualized / 70% win rate / >65 score gate, and no fixed ranking of annualized return > win rate > score. Keep objective outcome and forecast-quality measurements without treating them as the retired scoring system. Private advisor only: suggest opportunities and notify the user, who independently decides and manually trades. Do not read or track actual holdings. Historical simulator must track **simulated** holdings only. No four strategies or four pools.
