"""Read-only cross-run experiment audit; never promote models automatically.

Different validation windows or data fingerprints are not directly comparable.
Code versions are retained as audit metadata but model parameters are compared
only within an otherwise identical evaluation context.
"""
import json

CONTEXT_KEYS = ("validation_window", "evaluation_version", "dataset_version",
                "feature_version", "fee_version")


def context_key(row):
    report = row.get("report") or {}
    context = report.get("comparison_context") or {}
    values = [row.get("symbol"), row.get("strategy"), row.get("timeframe"),
              row.get("lookback_years")]
    values.extend(context.get(key) for key in CONTEXT_KEYS)
    if any(value is None for value in values):
        return None
    return json.dumps(values, sort_keys=True, separators=(",", ":"))


def experiment_key(params):
    if not isinstance(params, dict) or not params:
        return None
    return json.dumps(params, sort_keys=True, separators=(",", ":"))


def compare_experiment_history(current, history):
    """Classify matching historical experiments; no holdout-based ranking."""
    key = context_key(current)
    if key is None:
        return {"status": "NO_COMPARABLE_CONTEXT", "comparable_runs": 0,
                "tested_params": [], "next_experiment": None}
    comparable = [row for row in history if row.get("run_key") != current.get("run_key")
                  and context_key(row) == key]
    tested = set()
    for row in comparable + [current]:
        optimization = (row.get("report") or {}).get("optimization") or {}
        for experiment in optimization.get("experiments") or []:
            candidate_key = experiment_key(experiment.get("params"))
            if candidate_key:
                tested.add(candidate_key)
    proposal = ((current.get("report") or {}).get("optimization") or {}).get("next_experiment") or {}
    params = proposal.get("params")
    proposed_key = experiment_key(params)
    duplicate = proposed_key is not None and proposed_key in tested
    return {
        "status": "DUPLICATE_PROPOSAL" if duplicate else
                  ("NEW_VALIDATION_REQUIRED" if proposed_key else "WAIT"),
        "comparable_runs": len(comparable),
        "tested_params": [json.loads(item) for item in sorted(tested)],
        "next_experiment": None if duplicate else params,
        "reason": "previously_tested_in_same_context" if duplicate else
                  proposal.get("reason"),
        "requires_new_validation_window": True,
        "auto_execute": False,
        "auto_promote": False,
    }
