"""Fair generation comparison: champion and challenger evaluated on the SAME fresh window.

Both models must be retrained with identical data and fee assumptions. The
caller supplies their results; this module never uses holdout for selection.
"""

import math
from .model_qualification import (MIN_ANNUALIZED_RETURN_PERCENT,
                                  MIN_WIN_RATE_PERCENT, MIN_MEAN_SCORE_Q)


def decide_generation_promotion(champion, challenger, *,
                                same_validation_window, min_trades=5,
                                max_drawdown_percent=8.0,
                                min_score_improvement=0.25):
    """Research promotion only; no production activation or trading."""
    if not same_validation_window:
        return {"status": "WAIT", "reason": "different_evaluation_windows",
                "research_promoted": False}
    required = ("return_percent", "drawdown_percent", "closed_trades",
                "execution_path_uncertain", "annualized_return_percent",
                "win_rate_percent", "mean_score_q")
    if not all(isinstance(item, dict) and all(k in item for k in required)
               for item in (champion, challenger)):
        return {"status": "WAIT", "reason": "missing_comparable_metrics",
                "research_promoted": False}
    def eligible(metrics):
        numeric = ("return_percent", "drawdown_percent", "closed_trades",
                   "annualized_return_percent", "win_rate_percent", "mean_score_q")
        if not all(isinstance(metrics[k], (int, float)) and not isinstance(metrics[k], bool)
                   and math.isfinite(metrics[k]) for k in numeric):
            return False
        return (metrics["closed_trades"] >= min_trades
                and not metrics["execution_path_uncertain"]
                and 0 <= metrics["drawdown_percent"] <= max_drawdown_percent
                and metrics["annualized_return_percent"] >= MIN_ANNUALIZED_RETURN_PERCENT
                and metrics["win_rate_percent"] >= MIN_WIN_RATE_PERCENT
                and metrics["mean_score_q"] >= MIN_MEAN_SCORE_Q)
    if not eligible(champion):
        return {"status": "WAIT", "reason": "champion_not_eligible",
                "research_promoted": False}
    if not eligible(challenger):
        return {"status": "REJECT", "reason": "challenger_not_eligible",
                "research_promoted": False}
    old_score = champion["return_percent"] - champion["drawdown_percent"]
    new_score = challenger["return_percent"] - challenger["drawdown_percent"]
    delta = new_score - old_score
    if delta < min_score_improvement:
        return {"status": "REJECT", "reason": "insufficient_improvement",
                "score_delta": delta, "research_promoted": False}
    if challenger["drawdown_percent"] > champion["drawdown_percent"]:
        return {"status": "REJECT", "reason": "drawdown_worsened",
                "score_delta": delta, "research_promoted": False}
    return {"status": "RESEARCH_CANDIDATE", "reason": "same_window_improvement",
            "score_delta": delta, "research_promoted": True,
            "live_promoted": False, "paper_promoted": False}
