"""Independent model gates: validation selection, one-time holdout acceptance, paper activation.

Holdout is never used to select thresholds, rank candidates, or promote a champion.
This module produces an audit recommendation only, not an activation command.
"""
import math

MIN_HOLDOUT_TRADES = 5
MAX_HOLDOUT_DRAWDOWN_PERCENT = 8.0
MIN_ANNUALIZED_RETURN_PERCENT = 10.0
MIN_WIN_RATE_PERCENT = 70.0
MIN_MEAN_SCORE_Q = 65.0


def evaluate_model_gates(selection, metrics):
    validation_eligible = selection.get("selected_threshold") is not None
    trades = metrics.get("closed_trades")
    drawdown = metrics.get("max_close_to_close_drawdown_percent")
    equity = metrics.get("final_mark_to_market_equity")
    annualized = metrics.get("annualized_return_percent")
    win_rate = metrics.get("win_rate_percent")
    mean_score = metrics.get("mean_score_q")
    finite = all(isinstance(v, (int, float)) and not isinstance(v, bool)
                 and math.isfinite(v) for v in (trades, drawdown, equity,
                                                annualized, win_rate, mean_score))
    holdout_accepted = bool(
        validation_eligible and finite and trades >= MIN_HOLDOUT_TRADES
        and 0 <= drawdown <= MAX_HOLDOUT_DRAWDOWN_PERCENT
        and equity > 0
        and annualized >= MIN_ANNUALIZED_RETURN_PERCENT
        and win_rate >= MIN_WIN_RATE_PERCENT
        and mean_score >= MIN_MEAN_SCORE_Q
        and not metrics.get("execution_path_uncertain", True)
    )
    # Independent acceptance does not itself authorize running paper orders.
    return {
        "validation_eligible": validation_eligible,
        "holdout_accepted": holdout_accepted,
        "paper_eligible": False,
        "champion_eligible": False,
        "activation_status": "WAIT_MANUAL_REVIEW" if holdout_accepted else "NO_MODEL",
        "holdout_review_reason": (
            "passed_independent_acceptance_requires_manual_review"
            if holdout_accepted else "holdout_acceptance_not_met"
        ),
    }
