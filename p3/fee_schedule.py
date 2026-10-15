"""Read the configured per-side trading fee from the Supabase fee table."""

def load_fee_rate(db, category="CRYPTO"):
    instrument_type = "CRYPTO_SPOT" if category == "CRYPTO" else category
    rows = db("GET", "instrument_fee_schedule", {
        "select": "buy_fee_rate,sell_fee_rate",
        "category": "eq." + category,
        "instrument_type": "eq." + instrument_type,
        "venue": "eq.BINANCE",
        "market": "eq.SPOT_ASSUMPTION",
        "limit": "1",
    })
    if not isinstance(rows, list) or len(rows) != 1:
        raise ValueError("fee schedule missing or ambiguous")
    buy = float(rows[0]["buy_fee_rate"])
    sell = float(rows[0]["sell_fee_rate"])
    if not (0 <= buy < 1 and 0 <= sell < 1):
        raise ValueError("invalid fee rate")
    if buy != sell:
        raise ValueError("replay requires symmetric per-side fees")
    return buy
