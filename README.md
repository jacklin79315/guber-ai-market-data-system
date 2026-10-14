# guber AI Market Data System

V1: Immutable-source Binance Spot closed-candle ingestion. **No technical indicators, charting, AI training or trading.**

## Approved scope
- Initial instruments: BTCUSDT and ETHUSDT (Binance Spot).
- Independent native intervals: 15m, 1h, 4h, 1d; never resample smaller candles.
- Retain all 12 fields returned by Binance /api/v3/klines, preserving numeric values as supplied.
- Only ingest candles whose close time is earlier than verified Binance server time; exclude the forming candle.
- Every 15 minutes, inspect the latest 100 *closed* candles for each active instrument/interval.
- Every day at 09:00 Asia/Taipei, audit the entire configured 1–3-year lookback, page through source history, and backfill missing candles.
- Adding an instrument to the watchlist enqueues a full historical backfill immediately, without blocking current sync.
- Prevent duplicates with (source, market, symbol, interval, open_time) unique key; conflicting source payloads are logged, not silently overwritten.
- Respect exchange listing times, trading sessions, outages, rate limits, and provider-specific calendars.
- Admin panel: discover supported instruments, enable/disable, configure lookback, inspect jobs and data quality; no charts.
- Future non-Binance assets require separate licensed data providers; do not mislabel proxies as native stock/ETF/commodity prices.

## Implementation phases
1. Database schema, uniqueness, watchlist, jobs and quality issue tables.
2. Binance native closed-candle fetcher and deterministic validation.
3. Recent sync, daily full-range audit, and on-add backfill jobs.
4. Admin backend, tests, deployment and end-to-end verification.
5. Later version: indicator calculations in separate derived-data tables.

**Status:** Infrastructure project creation initiated; this document is the V1 contract, not proof of a running ingestion service.
