"""Trainable, horizon-specific AI decision model.

The model learns direction and future upside/downside magnitudes from historical
features. Targets are for supervised training only; predictions never access
future candles. No fixed indicator-based buy/sell rules are used.
"""
import math
import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from .paper_engine import Decision

FEATURE_COLUMNS = (
    "return_1", "return_3", "return_5", "return_10", "rsi_6",
    "rsi_12", "rsi_24", "macd_histogram", "adx_14", "atr_percent",
    "volume_ratio", "bb_width", "bollinger_zscore", "body_ratio",
    "price_ema_ratio_20", "price_ema_ratio_50", "ema_slope_20",
    "ema_slope_50", "rsi_12_change", "macd_histogram_change",
)
HORIZON_BARS = {
    "INTRADAY": 16, "ONE_TO_THREE_DAYS": 48,
    "ONE_WEEK": 42, "FIFTEEN_TO_THIRTY_DAYS": 22,
}

def _vector(row):
    values = []
    for key in FEATURE_COLUMNS:
        value = row.get(key)
        try:
            number = float(value)
        except (ValueError, TypeError):
            number = float("nan")
        values.append(number if math.isfinite(number) else float("nan"))
    return values

def build_supervised_examples(features, candles, horizon_bars):
    """Align closed feature rows to native bars; future bars used ONLY as labels.

    A sample ending at bar i uses bars i+1 through i+horizon for its targets.
    The last horizon bars are excluded because their labels are unavailable.
    """
    by_close = {int(c["close_time"]): i for i, c in enumerate(candles)}
    X, y_direction, y_up, y_down, timestamps = [], [], [], [], []
    for row in features:
        i = by_close.get(int(row["close_time"]))
        if i is None or i + horizon_bars >= len(candles):
            continue
        current = float(candles[i]["close"])
        future = candles[i + 1:i + horizon_bars + 1]
        if current <= 0:
            continue
        end = float(future[-1]["close"])
        upside = max(float(c["high"]) for c in future) / current - 1
        downside = 1 - min(float(c["low"]) for c in future) / current
        X.append(_vector(row))
        y_direction.append(int(end > current))
        y_up.append(max(0., upside))
        y_down.append(max(0., downside))
        timestamps.append(int(row["close_time"]))
    return np.asarray(X), np.asarray(y_direction), np.asarray(y_up), np.asarray(y_down), timestamps

class HorizonModel:
    def __init__(self, *, max_iter=120, learning_rate=0.1):
        self.direction = HistGradientBoostingClassifier(max_iter=max_iter, learning_rate=learning_rate, random_state=42)
        self.upside = HistGradientBoostingRegressor(max_iter=max_iter, learning_rate=learning_rate, random_state=42)
        self.downside = HistGradientBoostingRegressor(max_iter=max_iter, learning_rate=learning_rate, random_state=42)
        self.fitted = False

    def fit(self, X, y_direction, y_up, y_down):
        if len(X) < 100 or len(np.unique(y_direction)) < 2:
            raise ValueError("insufficient labeled training data")
        self.direction.fit(X, y_direction)
        self.upside.fit(X, y_up)
        self.downside.fit(X, y_down)
        self.fitted = True
        return self

    def decide(self, symbol, row, *, confidence_threshold=0.6, allocation=0.5):
        """Return model-generated direction and price targets or explicit WAIT.

        Entry is the known decision-candle close; only next-candle touch fills.
        Magnitudes are model predictions, not ATR heuristics.
        """
        if not self.fitted:
            raise ValueError("model not trained")
        probabilities = self.direction.predict_proba([_vector(row)])[0]
        probability_up = float(probabilities[list(self.direction.classes_).index(1)])
        entry = float(row["close_price"])
        up = max(0., float(self.upside.predict([_vector(row)])[0]))
        down = max(0., float(self.downside.predict([_vector(row)])[0]))
        if not math.isfinite(entry) or entry <= 0 or not all(math.isfinite(x) for x in (up, down)):
            raise ValueError("invalid model output")
        if not 0.5 < confidence_threshold < 1.0:
            raise ValueError("confidence_threshold must be between 0.5 and 1")
        if down >= 1.0:
            return Decision("WAIT", symbol)
        if probability_up >= confidence_threshold and up > 0 and down > 0:
            decision = Decision("LONG", symbol, entry, entry * (1 + up), entry * (1 - down), allocation)
        elif probability_up <= 1 - confidence_threshold and up > 0 and down > 0:
            decision = Decision("SHORT", symbol, entry, entry * (1 - down), entry * (1 + up), allocation)
        else:
            return Decision("WAIT", symbol)
        decision.validate()
        return decision
