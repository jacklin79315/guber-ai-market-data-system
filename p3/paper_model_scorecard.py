"""Conservative paper-model scorecard; not authorization to trade.

Scores are descriptive and withheld until sufficient independent OOS trades.
No annualization from R multiples or synthetic equity curves.
"""
from math import isfinite


def score_paper_model(*, trades, total_net_r, max_drawdown_r,
                      profit_factor, monthly_net_r=None, min_trades=30):
    if not isinstance(trades, int) or trades < 0 or min_trades < 1:
        raise ValueError("invalid trade count")
    numeric = (total_net_r, max_drawdown_r)
    if any(not isinstance(v, (int, float)) or not isfinite(v) for v in numeric):
        raise ValueError("nonfinite performance input")
    if max_drawdown_r < 0:
        raise ValueError("drawdown must be nonnegative")
    monthly_net_r = monthly_net_r or []
    if any(not isinstance(v, (int, float)) or not isfinite(v) for v in monthly_net_r):
        raise ValueError("nonfinite monthly result")
    avg_net_r = total_net_r / trades if trades else None
    sufficient = trades >= min_trades and len(monthly_net_r) >= 3
    # Insufficient evidence is not a zero-score model; it is unscored.
    result = {
        "score_version": "paper_scorecard_v1",
        "status": "SCORED" if sufficient else "INSUFFICIENT_EVIDENCE",
        "total_score": None,
        "score_components": None,
        "trades": trades,
        "average_net_r": avg_net_r,
        "total_net_r": total_net_r,
        "max_drawdown_r": max_drawdown_r,
        "profit_factor": profit_factor,
        "observed_months": len(monthly_net_r),
        "minimum_trades": min_trades,
        "research_only": True,
        "eligible_for_promotion": False,
        "annualized_return": None,
        "warning": "Independent out-of-sample windows required; score is descriptive, not live trading approval.",
    }
    if not sufficient:
        return result
    if profit_factor is None or not isinstance(profit_factor, (int, float)) or not isfinite(profit_factor) or profit_factor < 0:
        return {**result, "status": "MISSING_PROFIT_FACTOR"}
    # Fixed, bounded, transparent component scores; no fitted thresholds.
    profitability = max(0.0, min(1.0, avg_net_r / 0.3)) * 35
    risk = max(0.0, 1.0 - max_drawdown_r / 10.0) * 25
    stability = sum(v > 0 for v in monthly_net_r) / len(monthly_net_r) * 20
    # Reserve OOS and predictive scores until independent-window / baseline evidence exists.
    components = {"profitability": round(profitability, 3),
                  "risk": round(risk, 3),
                  "monthly_stability": round(stability, 3),
                  "out_of_sample": None, "prediction_quality": None}
    return {**result, "status": "PARTIAL_SCORE",
            "score_components": components,
            "total_score": None,
            "scored_weight": 80,
            "profit_factor_passes_one": profit_factor > 1.0}


if __name__ == "__main__":
    import json
    print(json.dumps(score_paper_model(trades=0, total_net_r=0,
        max_drawdown_r=0, profit_factor=None), sort_keys=True))
