"""Trade-feedback candidate exploration for 24-month research only.

Losses and high drawdowns guide research, but never qualify a model for use.
Independent holdout remains untouched.
"""
import math
from .walk_forward_replay import replay_walk_forward_research

DEFAULT_CANDIDATES = (
    {"max_iter": 80, "learning_rate": 0.05},
    {"max_iter": 120, "learning_rate": 0.10},
    {"max_iter": 160, "learning_rate": 0.05},
    {"max_iter": 80, "learning_rate": 0.10},
    {"max_iter": 160, "learning_rate": 0.10},
)


def feedback_rank(metrics):
    """Research-only loss-aware ranking; high drawdown is penalized, not ignored."""
    fields = ("annualized_return_percent", "win_rate_percent", "mean_score_q",
              "max_close_to_close_drawdown_percent")
    vals = [metrics.get(key) for key in fields]
    trades = metrics.get("normal_closed_trades")
    if (type(trades) is not int or trades < 5
            or any(type(v) not in (int, float) or not math.isfinite(v) for v in vals)
            or not 0 <= vals[3] <= 100
            or metrics.get("ambiguous_exit_count", 0)):
        return None
    annualized, win, quality, drawdown = vals
    # Drawdown above 35% must reduce research priority even when returns improve.
    return (annualized - 2 * max(0, drawdown - 35), -drawdown, win, quality)


def research_rank(metrics):
    """Conservative research qualification; never a holdout promotion gate."""
    rank = feedback_rank(metrics)
    if rank is None or metrics["max_close_to_close_drawdown_percent"] > 35:
        return None
    return (metrics["annualized_return_percent"], metrics["win_rate_percent"],
            metrics["mean_score_q"])


def _candidate_choice(history, candidates):
    seen = {tuple(sorted(row["params"].items())) for row in history}
    remaining = [dict(p) for p in candidates
                 if tuple(sorted(p.items())) not in seen]
    if not remaining:
        return None, None
    ranked = [row for row in history if feedback_rank(row["metrics"]) is not None]
    if not ranked:
        return remaining[0], None
    best = max(ranked, key=lambda row: feedback_rank(row["metrics"]))
    anchor = best["params"]
    choice = min(remaining, key=lambda p: (
        abs(p["max_iter"] - anchor["max_iter"]) / 100
        + abs(p["learning_rate"] - anchor["learning_rate"]) / 0.05,
        p["max_iter"], p["learning_rate"]))
    return choice, best["trial_index"] if "trial_index" in best else None


def select_research_candidate(history, candidates=DEFAULT_CANDIDATES):
    return _candidate_choice(history, candidates)[0]


def run_research_iterations(candles, features, strategy, research, *,
                            iterations=5, fee_rate=0.0, slippage_rate=0.0,
                            candidates=DEFAULT_CANDIDATES, symbol=None):
    if type(iterations) is not int or not 1 <= iterations <= len(candidates):
        raise ValueError("iterations must be within the available candidate grid")
    history = []
    for index in range(iterations):
        params, feedback_source = _candidate_choice(history, candidates)
        if params is None:
            break
        result = replay_walk_forward_research(
            candles, features, strategy, research, params=params,
            fee_rate=fee_rate, slippage_rate=slippage_rate, symbol=symbol)
        metrics = result["research_trading_metrics"]
        history.append({
            "trial_index": index + 1, "params": params, "metrics": metrics,
            "research_rank": research_rank(metrics),
            "feedback_rank": feedback_rank(metrics),
            "selection_basis": ("PRIOR_RESEARCH_TRADING_FEEDBACK" if feedback_source
                                is not None else "INITIAL_EXPLORATION"),
            "feedback_source_trial_index": feedback_source,
            "trade_count": result["research_trades"],
            "checkpoints": result["training_checkpoints"],
            "eligible_for_promotion": False,
        })
    ranked = [h for h in history if h["feedback_rank"] is not None]
    qualified = [h for h in history if h["research_rank"] is not None]
    return {
        "strategy": strategy, "research_window": list(research),
        "iterations": history,
        "best_research_trial_index": (
            max(qualified, key=lambda h: h["research_rank"])["trial_index"]
            if qualified else None),
        "best_observed_trial_index": (
            max(ranked, key=lambda h: h["feedback_rank"])["trial_index"]
            if ranked else None),
        "feedback_used_for_candidate_selection": any(
            h["feedback_source_trial_index"] is not None for h in history),
        "independent_validation_performed": False,
        "eligible_for_promotion": False,
    }
