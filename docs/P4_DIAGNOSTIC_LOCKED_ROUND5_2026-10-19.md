# P4 第五輪：鎖定候選歷史驗證

GitHub Actions: https://github.com/jacklin79315/guber-ai-market-data-system/actions/runs/39164038369 (SUCCESS)
Supabase immutable job: `p4_locked_entry_17_retro_20261019_01`, `LOCKED_CANDIDATE_RETROSPECTIVE_EVALUATED`.
固定候選 Entry lookback 20→17，來源第四輪 `p4_diag_entry_multiscale_20261019_01`。本輪不重新搜尋候選。
BTCUSDT 1h 2000 verified candles; historical window 1785106799999–1792303199999 close times.
Original lookback20: 65 closed trades, net PNL -80.675733 USDT, fees 36.936450, return -0.806757%.
Candidate lookback17: 64 closed trades, net PNL -82.439798 USDT, fees 37.913078, return -0.824398%.
Candidate delta = -1.764065 USDT. `improvedInSameWindow=false`. Fourth round promising result did not generalize to this retrospective window. This is not prospective independent validation and was not a pristine unseen period in the entire research program.
No model update, no Champion promotion, no automated live orders. Keep 17 as a rejected-for-promotion candidate until further prespecified independent evidence; do not tune to this validation period.
