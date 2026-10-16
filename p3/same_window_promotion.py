"""Fair generation comparison: champion and challenger evaluated on the SAME fresh window.

Both models must be retrained with identical data and fee assumptions. The
caller supplies their results; this module never uses holdout for selection.
"""

import math
from .model_qualification import (MIN_ANNUALIZED_RETURN_PERCENT,
                                  MIN_WIN_RATE_PERCENT, MIN_MEAN_SCORE_Q,
                                  MAX_HOLDOUT_DRAWDOWN_PERCENT)


def decide_generation_promotion(champion, challenger, *,
                                same_validation_window, min_trades=5,
                                max_drawdown_percent=MAX_HOLDOUT_DRAWDOWN_PERCENT):
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
    # Compare qualified models lexicographically: annualized return first,
    # then win rate, then mean trade score. Each promoted champion raises the
    # strategy-specific benchmark; the absolute floors never decrease.
    priority = ("annualized_return_percent", "win_rate_percent", "mean_score_q")
    old_rank = tuple(champion[k] for k in priority)
    new_rank = tuple(challenger[k] for k in priority)
    if new_rank <= old_rank:
        return {"status": "REJECT", "reason": "no_priority_order_improvement",
                "champion_rank": old_rank, "challenger_rank": new_rank,
                "research_promoted": False}
    if (challenger["drawdown_percent"] > champion["drawdown_percent"]
            and challenger["drawdown_percent"] > 8):
        return {"status": "REJECT", "reason": "drawdown_worsened_outside_best_tier",
                "champion_rank": old_rank, "challenger_rank": new_rank,
                "research_promoted": False}
    return {"status": "RESEARCH_CANDIDATE", "reason": "same_window_improvement",
            "champion_rank": old_rank, "challenger_rank": new_rank,
            "research_promoted": True,
            "live_promoted": False, "paper_promoted": False}
