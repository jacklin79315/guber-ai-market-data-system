"""Trade-feedback-driven candidate exploration for 24-month research.

Only research trades influence the next candidate. Independent holdout is
never inspected here; no result from this module is promotion-eligible.
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


def research_rank(metrics):
    """Rank research candidates by approved return/win/quality priority.

    Drawdown >35% and unresolved executions are not eligible to guide
    candidate exploitation; other trials remain available for exploration.
    This is NOT an independent validation or formal qualification gate.
    """
    keys = ("annualized_return_percent", "win_rate_percent", "mean_score_q")
    values = [metrics.get(k) for k in keys]
    dd = metrics.get("max_close_to_close_drawdown_percent")
    trades = metrics.get("normal_closed_trades", 0)
    if (not isinstance(trades, int) or trades < 5
            or not isinstance(dd, (int, float)) or not math.isfinite(dd)
            or not 0 <= dd <= 35
            or metrics.get("entry_bars_with_unresolved_exit", 0)
            or metrics.get("ambiguous_exit_count", 0)
            or any(not isinstance(v, (int, float)) or isinstance(v, bool)
                   or not math.isfinite(v) for v in values)):
        return None
    return tuple(values)


def select_research_candidate(history, candidates=DEFAULT_CANDIDATES):
    """Choose an untried candidate, anchored to the best *trading* result."""
    seen = {tuple(sorted(row["params"].items())) for row in history}
    remaining = [dict(p) for p in candidates
                 if tuple(sorted(p.items())) not in seen]
    if not remaining:
        return None
    eligible = [row for row in history if research_rank(row["metrics"]) is not None]
    if not eligible:
        return remaining[0]
    best = max(eligible, key=lambda row: research_rank(row["metrics"]))
    anchor = best["params"]
    return min(remaining, key=lambda p: (
        abs(p["max_iter"] - anchor["max_iter"]) / 100
        + abs(p["learning_rate"] - anchor["learning_rate"]) / 0.05,
        p["max_iter"], p["learning_rate"]))


def run_research_iterations(candles, features, strategy, research, *,
                            iterations=5, fee_rate=0.0, slippage_rate=0.0,
                            candidates=DEFAULT_CANDIDATES, symbol=None):
    """Perform sequential trading-feedback experiments; no DB writes or promotion."""
    if not isinstance(iterations, int) or not 1 <= iterations <= len(candidates):
        raise ValueError("iterations must be within the available candidate grid")
    history = []
    for index in range(iterations):
        params = select_research_candidate(history, candidates)
        if params is None:
            break
        result = replay_walk_forward_research(
            candles, features, strategy, research, params=params,
            fee_rate=fee_rate, slippage_rate=slippage_rate, symbol=symbol)
        metrics = result["research_trading_metrics"]
        rank = research_rank(metrics)
        previous = history[-1] if history else None
        history.append({
            "trial_index": index + 1, "params": params, "metrics": metrics,
            "research_rank": rank,
            "selection_basis": ("INITIAL_EXPLORATION" if previous is None else
                                "PRIOR_RESEARCH_TRADING_FEEDBACK"),
            "previous_trial_index": previous["trial_index"] if previous else None,
            "trade_count": result["research_trades"],
            "checkpoints": result["training_checkpoints"],
            "eligible_for_promotion": False,
        })
    return {"strategy": strategy, "research_window": list(research),
            "iterations": history,
            "best_research_trial_index": (
                max((h for h in history if h["research_rank"] is not None),
                    key=lambda h: h["research_rank"], default={})
                .get("trial_index")),
            "feedback_used_for_candidate_selection": any(
                h["selection_basis"] == "PRIOR_RESEARCH_TRADING_FEEDBACK"
                and any(research_rank(prev["metrics"]) is not None
                        for prev in history[:i])
                for i, h in enumerate(history)),
            "independent_validation_performed": False,
            "eligible_for_promotion": False}
