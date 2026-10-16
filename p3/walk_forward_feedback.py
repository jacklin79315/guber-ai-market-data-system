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
    {"max_iter": 60, "learning_rate": 0.025},
    {"max_iter": 100, "learning_rate": 0.025},
    {"max_iter": 140, "learning_rate": 0.025},
    {"max_iter": 200, "learning_rate": 0.05},
    {"max_iter": 200, "learning_rate": 0.10},
)


def feedback_rank(metrics):
    """Research-only ranking; 35%-40% is diagnosis-only and >40% excluded."""
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
    # >40%: excluded from all candidate selection and feedback learning.
    # >35%-40%: retained only for failure diagnosis, never an optimization anchor.
    if drawdown > 35:
        return None
    # 0%-8% is a single best risk tier; do not reward lower drawdown within it.
    return (annualized, win, quality, -max(0, drawdown - 8))



def exploration_rank(metrics):
    """Research-only candidate ranking regardless of drawdown severity.

    High drawdown remains disqualifying for qualification and promotion.
    """
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
    return (annualized, win, quality, -max(0, drawdown - 8))



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



def diagnose_feedback_hypothesis(history):
    """Produce an auditable hypothesis from eligible prior trade evidence only.

    No causal claim, parameter mutation, or new model policy is authorized.
    """
    eligible = [row for row in history if feedback_rank(row["metrics"]) is not None]
    if not eligible:
        return {"status": "NO_ELIGIBLE_FEEDBACK", "source_trial_index": None,
                "hypothesis": None, "evidence": None}
    best = max(eligible, key=lambda row: feedback_rank(row["metrics"]))
    evidence = best.get("eligible_trade_diagnosis") or {}
    groups = evidence.get("by_direction") or {}
    comparable = [(side, group) for side, group in groups.items()
                  if group.get("closed", 0) >= 5]
    if not comparable:
        return {"status": "INSUFFICIENT_TRADE_EVIDENCE",
                "source_trial_index": best.get("trial_index"),
                "hypothesis": None,
                "evidence": {"direction_samples": {side: g.get("closed", 0)
                                                   for side, g in groups.items()}}}
    side, group = min(comparable, key=lambda pair: (
        pair[1].get("win_rate_percent", 0), pair[0]))
    return {"status": "TESTABLE_HYPOTHESIS_ONLY",
            "source_trial_index": best.get("trial_index"),
            "hypothesis": "REVIEW_DIRECTION_OUTCOMES_" + side,
            "evidence": {"side": side, "closed": group["closed"],
                         "win_rate_percent": group.get("win_rate_percent"),
                         "net_pnl": group.get("net_pnl")},
            "limitations": "Descriptive association, not proof of model error; "
                           "no model or risk rules changed."}


def select_research_candidate(history, candidates=DEFAULT_CANDIDATES):
    return _candidate_choice(history, candidates)[0]


def run_research_iterations(candles, features, strategy, research, *,
                            iterations=5, fee_rate=0.0, slippage_rate=0.0,
                            candidates=DEFAULT_CANDIDATES, symbol=None):
    if type(iterations) is not int or not 1 <= iterations <= len(candidates):
        raise ValueError("iterations must be within the available candidate grid")
    from .autonomous_experiment_plan import (research_data_fingerprint,
                                             compare_iteration_records)
    fingerprint = research_data_fingerprint(candles, features, research)
    history = []
    for index in range(iterations):
        hypothesis = diagnose_feedback_hypothesis(history)
        from .autonomous_experiment_plan import propose_experiment
        experiment_proposal = propose_experiment(hypothesis)
        params, feedback_source = _candidate_choice(history, candidates)
        if params is None:
            break
        result = replay_walk_forward_research(
            candles, features, strategy, research, params=params,
            fee_rate=fee_rate, slippage_rate=slippage_rate, symbol=symbol)
        metrics = result["research_trading_metrics"]
        history.append({
            "drawdown_failure_diagnosis": result.get("drawdown_failure_diagnosis"),
            "eligible_trade_diagnosis": result.get("eligible_trade_diagnosis"),
            "trial_index": index + 1, "params": params, "metrics": metrics,
            "strategy": strategy, "research_window": list(research),
            "symbol": symbol, "fee_rate": fee_rate,
            "slippage_rate": slippage_rate, "data_fingerprint": fingerprint,
            "prior_feedback_hypothesis": hypothesis,
            "autonomous_experiment_proposal": experiment_proposal,
            "research_rank": research_rank(metrics),
            "feedback_rank": feedback_rank(metrics),
            "selection_basis": ("PRIOR_RESEARCH_TRADING_FEEDBACK" if feedback_source
                                is not None else "INITIAL_EXPLORATION"),
            "feedback_source_trial_index": feedback_source,
            "trade_count": result["research_trades"],
            "checkpoints": result["training_checkpoints"],
            "eligible_for_promotion": False,
        })
        if feedback_source is not None:
            baseline = next(row for row in history
                            if row["trial_index"] == feedback_source)
            history[-1]["paired_research_comparison"] = compare_iteration_records(
                baseline, history[-1])
        else:
            history[-1]["paired_research_comparison"] = None
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
        "candidate_grid_exhausted": len(history) == len(candidates),
        "latest_feedback_hypothesis": diagnose_feedback_hypothesis(history),
        "feedback_used_for_candidate_selection": any(
            h["feedback_source_trial_index"] is not None for h in history),
        "independent_validation_performed": False,
        "eligible_for_promotion": False,
    }
