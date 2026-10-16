# AI Trading System V2 — Architecture Contract

Status: architecture baseline; not a claim that AI training or trading is deployed.

## Protected market-data layer
- Preserve existing `raw_candles` and `market_features` data and tables.
- Preserve `market_data_watchlist`, `ingestion_jobs`, and `data_quality_issues` while the native collector depends on them.
- Keep `collector.py`, `feature_engine.py`, `worker.py`, `Procfile`, `requirements.txt`.
- Native Binance Spot closed K-lines only; independent 15m, 1h, 4h, 1d intervals; no synthetic 5m aggregation.
- Ingestion/feature computation are separate from AI decision-making. No mutation of raw candles for training.

## V2 AI roles
Five independent specialists:
1. Entry: propose entry price range and directional candidate.
2. Reward: propose take-profit range and expected reward/risk.
3. Win Probability: estimate calibrated probability with uncertainty.
4. Risk/Position: stop-loss range and affordable position sizing.
5. Time: estimate holding duration; cannot veto a trade.

Brain adjudicator: APPROVE, RETURN, REJECT, WAIT, with attributable rationale. Diagnostic AI evaluates completed simulations and attributes errors to the responsible specialist. Each specialist may have independently promoted champion/challenger versions. No legacy 0–100 trade scoring.

## Four independent strategy horizons
Intraday; 1–3 days; 1 week; 15–30 days. Each has independent finite capital and accounting; no leverage. No automated real-money order placement.

## Simulation invariants
- Decisions only use information available at decision time.
- Decision candle cannot fill; earliest fill is the next candle.
- If take-profit or stop-loss is touched before a pending entry fills, cancel that pending entry.
- No arbitrary expiration of an unfilled entry.
- If both TP and SL touch on the same candle, use whichever is closer to candle close; exact tie is SL.
- Same symbol, same timeframe: approved open entry ranges must not overlap. Different timeframes remain independent.
- Model trading costs: spot fees and slippage.
- Support LONG, SHORT, WAIT in research; short execution must not be represented as executable spot trading without borrow/margin.

## Training and evaluation
- Simulate chronological 24-month histories; iterative challenger research up to 100 rounds, not 100 independent identical replays.
- Keep causal data separation and out-of-sample assessment without an arbitrary 30-day embargo.
- Evaluate net profit, annualized return, maximum drawdown, win rate, payoff ratio, trade count, and per-horizon outcomes.
- Do not select models using a fixed minimum win-rate or annual-return threshold; compare candidate results after evaluation.
- Require reproducible seeds, data/version lineage, run logs, and explicit promotion decisions.

## Delivery sequence
1. Define and test V2 storage schema without changing the protected market-data layer.
2. Implement typed market-data adapter and chronological simulator.
3. Implement five expert contracts, brain, WAIT, and diagnostic attribution.
4. Implement iterative challenger training and objective evaluation.
5. Add read-only training dashboard and monitoring.

No real-money auto-ordering feature is in scope.
