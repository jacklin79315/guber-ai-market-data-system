"""Read and validate admin-selected training settings (never write database data)."""
ALLOWED_SYMBOLS = ("BTCUSDT", "ETHUSDT")
ALLOWED_YEARS = (1, 2, 3)

def load_training_settings(db):
    rows = db("GET", "web_training_settings", {"select": "config", "id": "eq.1", "limit": "1"})
    if len(rows) != 1 or not isinstance(rows[0].get("config"), dict):
        raise ValueError("missing training settings")
    config = rows[0]["config"]
    symbol = config.get("symbol")
    days = config.get("lookback_days")
    if symbol not in ALLOWED_SYMBOLS:
        raise ValueError("unsupported training symbol")
    if type(days) is not int or days not in (365, 730, 1095):
        raise ValueError("training lookback_days must be 365, 730 or 1095")
    return {"symbol": symbol, "years": {365: 1, 730: 2, 1095: 3}[days]}
