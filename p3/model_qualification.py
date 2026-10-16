"""Independent model gates: validation selection, one-time holdout acceptance, paper activation.

Holdout is never used to select thresholds, rank candidates, or promote a champion.
This module produces an audit recommendation only, not an activation command.
"""
import math

MIN_HOLDOUT_TRADES = 5
MAX_HOLDOUT_DRAWDOWN_PERCENT = 35.0
BEST_DRAWDOWN_TIER_PERCENT = 8.0
ABSOLUTE_DRAWDOWN_REJECTION_PERCENT = 40.0
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
    settlement_valid = bool(
        isinstance(trades, (int, float)) and not isinstance(trades, bool)
        and math.isfinite(trades) and trades >= 0
        and all(isinstance(v, (int, float)) and not isinstance(v, bool)
                and math.isfinite(v) for v in (boundary_count, boundary_percent, normal_trades))
        and boundary_count >= 0 and normal_trades == trades
        and 0 <= boundary_percent <= 100
        and abs(boundary_percent - (
            100 * boundary_count / (boundary_count + trades)
            if boundary_count + trades else 0.0)) < 1e-6
    )
    # Boundary settlements are administrative accounting, not completed trades.
    # They do not impose an additional qualification threshold.
    settlement_accepted = settlement_valid
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
    risk_tier = ("INVALID" if not isinstance(drawdown, (int, float)) or isinstance(drawdown, bool) or not math.isfinite(drawdown) or drawdown < 0
                 else "BEST_0_TO_8" if drawdown <= BEST_DRAWDOWN_TIER_PERCENT
                 else "CANDIDATE_8_TO_35" if drawdown <= MAX_HOLDOUT_DRAWDOWN_PERCENT
                 else "RESEARCH_ONLY_35_TO_40" if drawdown <= ABSOLUTE_DRAWDOWN_REJECTION_PERCENT
                 else "ABSOLUTE_REJECT_OVER_40")
    # Independent acceptance does not itself authorize running paper orders.
    return {
        "drawdown_risk_tier": risk_tier,
        "drawdown_research_only": risk_tier == "RESEARCH_ONLY_35_TO_40",
        "drawdown_absolute_reject": risk_tier == "ABSOLUTE_REJECT_OVER_40",
        "validation_eligible": validation_eligible,
        "holdout_accepted": holdout_accepted,
        "settlement_metrics_valid": settlement_valid,
        "settlement_policy_accepted": settlement_accepted,
        "settlement_policy_status": ("INVALID_OR_MISSING_METRICS" if not settlement_valid
            else "PASS" if settlement_accepted else "INVALID_OR_MISSING_METRICS"),
        "paper_eligible": False,
        "champion_eligible": False,
        "activation_status": "WAIT_MANUAL_REVIEW" if holdout_accepted else "NO_MODEL",
        "holdout_review_reason": (
            "passed_independent_acceptance_requires_manual_review"
            if holdout_accepted else "holdout_acceptance_not_met"
        ),
    }
