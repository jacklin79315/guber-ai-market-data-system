# P4 24-month BTCUSDT research — round 1 findings

Source: Supabase p4_research_rounds, job p4_btc_24m_accept_20261018, iteration 1; GitHub Actions run 39091624212.

BTCUSDT 1h, 17,520 candles, starting simulated capital 10,000 USDT. Research-only, no live orders.

| Metric | Champion | Challenger |
|---|---:|---:|
| Closed trades | 118 | 119 |
| Wins | 36 | 38 |
| Losses | 82 | 81 |
| Win rate | 30.51% | 31.93% |
| Net realized PnL (USDT) | -287.0065 | -311.2664 |
| Realized return | -2.8701% | -3.1127% |
| Profit factor | 0.6452 | 0.6194 |
| Total fees (USDT) | 145.6851 | 145.9302 |
| Average PnL/trade (USDT) | -2.4323 | -2.6157 |

Both saw 1,246 candidate signals. Champion: 1,109 non-positive-expectancy waits, 137 approved, 118 closed and 19 cancelled before fill. Challenger changed rewardStopAtr from 1.5 to 1.6, with worse same-window net PnL and profit factor. Promotion is prohibited. Champion calibration had only 58 qualified observations; the probability model was not updated. No independent out-of-sample validation exists.

Next: diagnose trade-level entry, direction, exit, costs and probability calibration using immutable decision evidence. Evaluate profitable as well as losing decisions. Avoid training promotion until untouched OOS validation.
