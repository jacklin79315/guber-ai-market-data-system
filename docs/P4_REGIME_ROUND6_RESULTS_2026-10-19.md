# P4 第六輪：固定 Entry 候選市場狀態歸因

Action: https://github.com/jacklin79315/guber-ai-market-data-system/actions/runs/39164498659 SUCCESS
Supabase immutable summary: `p4_locked_entry_17_regime_20261019_01`.
Same historical window as round five; this is DESCRIPTIVE ONLY and NOT independent validation.

Entry-time ADX/ATR group attribution, net realized USDT:
| Regime | Lookback 20 (trades) | Lookback 17 (trades) | Difference |
|---|---:|---:|---:|
| RANGE_HIGH_VOL | -12.341391 (18) | -4.141048 (16) | +8.200344 |
| TRANSITION_HIGH_VOL | -22.050222 (16) | -32.264790 (19) | -10.214568 |
| TREND_HIGH_VOL | -46.284120 (31) | -46.033960 (29) | +0.250159 |
| TOTAL | -80.675733 (65) | -82.439798 (64) | -1.764065 |

Fees 36.936450 (20) vs 37.913078 (17). All trades and net PNL reconcile within rounding to round five. Regime definitions: ADX>=25 TREND, ADX<20 RANGE, otherwise TRANSITION; ATR%>=0.02 HIGH_VOL. All observed groups in this window are HIGH_VOL; confirm ATR unit convention before interpreting volatility categories.

The apparent transition-period loss is an exploratory association, not a causal diagnosis. No strategy switch, promotion, model update or real trading is authorized.
