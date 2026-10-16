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


def evaluate_model_gates(selection, metrics, *, max_end_settlement_percent=None):
    validation_eligible = selection.get("selected_threshold") is not None
    trades = metrics.get("closed_trades")
    drawdown = metrics.get("max_close_to_close_drawdown_percent")
    equity = metrics.get("final_mark_to_market_equity")
    annualized = metrics.get("annualized_return_percent")
    win_rate = metrics.get("win_rate_percent")
    mean_score = metrics.get("mean_score_q")
    boundary_count = metrics.get("backtest_end_settlement_count")
    boundary_percent = metrics.get("backtest_end_settlement_percent")
    normal_trades = metrics.get("normal_closed_trades")
    settlement_valid = (
        all(isinstance(v, (int, float)) and not isinstance(v, bool)
            and math.isfinite(v) for v in (boundary_count, boundary_percent, normal_trades))
        and boundary_count >= 0 and normal_trades >= 0
        and boundary_count + normal_trades == trades
        and 0 <= boundary_percent <= 100
        and abs(boundary_percent - 100 * boundary_count / trades) < 1e-6
        if isinstance(trades, (int, float)) and not isinstance(trades, bool)
           and math.isfinite(trades) and trades > 0 else False
    )
    # No invented settlement-ratio threshold: unapproved nonzero settlements
    # remain research-only until a policy limit is explicitly supplied.
    limit_valid = (max_end_settlement_percent is not None
                   and isinstance(max_end_settlement_percent, (int, float))
                   and not isinstance(max_end_settlement_percent, bool)
                   and math.isfinite(max_end_settlement_percent)
                   and 0 <= max_end_settlement_percent <= 100)
    settlement_accepted = bool(settlement_valid and (
        boundary_count == 0 or (limit_valid and boundary_percent <= max_end_settlement_percent)
    ))
    finite = all(isinstance(v, (int, float)) and not isinstance(v, bool)
                 and math.isfinite(v) for v in (trades, drawdown, equity,
                                                annualized, win_rate, mean_score))
    holdout_accepted = bool(
        validation_eligible and finite and settlement_accepted and trades >= MIN_HOLDOUT_TRADES
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
        "settlement_metrics_valid": settlement_valid,
        "settlement_policy_accepted": settlement_accepted,
        "settlement_policy_status": ("INVALID_OR_MISSING_METRICS" if not settlement_valid
            else "PASS" if settlement_accepted else "WAIT_SETTLEMENT_RATIO_POLICY"),
        "paper_eligible": False,
        "champion_eligible": False,
        "activation_status": "WAIT_MANUAL_REVIEW" if holdout_accepted else "NO_MODEL",
        "holdout_review_reason": (
            "passed_independent_acceptance_requires_manual_review"
            if holdout_accepted else "holdout_acceptance_not_met"
        ),
    }
