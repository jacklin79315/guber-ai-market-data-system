"""Explain validation changes without changing existing model selection rules."""

METRICS = {
    "annualized_return_percent": ("validation_annualized_return_percent", 1),
    "win_rate_percent": ("validation_win_rate_percent", 1),
    "strategy_score": ("validation_mean_score_q", 1),
    "drawdown_percent": ("validation_drawdown_percent", -1),
    "closed_trades": ("validation_trades", 0),
    "direction_accuracy_percent": ("direction_accuracy_percent", 1),
    "direction_brier_score": ("direction_brier_score", -1),
    "upside_mae_percent": ("upside_mae_percent", -1),
    "downside_mae_percent": ("downside_mae_percent", -1),
}


def compare_trials(previous, current):
    """Return metric-level changes and known tradeoffs, never causal claims."""
    changes = {}
    for name, (field, preferred_sign) in METRICS.items():
        a = (previous.get("diagnostics") or {}).get(field) if field in (
            "direction_accuracy_percent", "direction_brier_score",
            "upside_mae_percent", "downside_mae_percent") else previous.get(field)
        b = (current.get("diagnostics") or {}).get(field) if field in (
            "direction_accuracy_percent", "direction_brier_score",
            "upside_mae_percent", "downside_mae_percent") else current.get(field)
        if a is None or b is None:
            changes[name] = {"delta": None, "assessment": "UNAVAILABLE"}
            continue
        delta = float(b) - float(a)
        assessment = ("UNCHANGED" if delta == 0 else
                      "CONTEXT_ONLY" if preferred_sign == 0 else
                      "IMPROVED" if delta * preferred_sign > 0 else "WORSENED")
        changes[name] = {"delta": delta, "assessment": assessment}
    return {
        "previous_trial_index": previous.get("trial_index"),
        "current_trial_index": current.get("trial_index"),
        "metrics": changes,
        "trading_qualification_unchanged": True,
        "causal_attribution": "NOT_ESTABLISHED",
        "evaluation_scope": "VALIDATION_ONLY",
    }
