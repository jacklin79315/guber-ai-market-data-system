"""Compare parent champion and new-generation challenger on the identical new validation window."""
import json
import os
from .ai_training_pipeline import train_horizon
from .validation_selection import select_threshold
from .same_window_promotion import decide_generation_promotion


def compare_current_generation(db, *, symbol, strategy, years, candles, features,
                               fee_rate, ranking):
    if int(os.getenv("TRAINING_GENERATION", "1")) < 2:
        return {"status": "BASELINE", "research_promoted": False}
    if not ranking:
        return {"status": "WAIT", "reason": "no_eligible_challenger",
                "research_promoted": False}
    parent_run = os.environ["TRAINING_PARENT_RUN_ID"]
    parents = db("GET", "ai_training_batch_trials", {
        "select": "params,validation_score,trial_index",
        "run_id": "eq." + parent_run, "symbol": "eq." + symbol,
        "strategy": "eq." + strategy, "validation_eligible": "eq.true",
        "order": "validation_score.desc,trial_index.asc", "limit": "1",
    })
    if not parents:
        return {"status": "WAIT", "reason": "no_parent_champion",
                "research_promoted": False}
    champion = train_horizon(features, candles, strategy, years=years,
                             model_params=parents[0]["params"])
    expected = json.loads(os.environ["TRAINING_CURRENT_VALIDATION_WINDOW"])
    actual = list(champion["windows"]["validation"])
    if actual != expected:
        return {"status": "WAIT", "reason": "champion_window_mismatch",
                "research_promoted": False}
    selected = select_threshold(candles, features, champion["model"], symbol,
                                champion["windows"]["validation"], fee_rate)
    old = next((x for x in selected["candidates"]
                if x["threshold"] == selected["selected_threshold"]), None)
    challenger = ranking[0]
    new = next((x for x in challenger["validation_candidates"]
                if x["threshold"] == challenger["selected_threshold"]), None)
    report = decide_generation_promotion(
        old, new, same_validation_window=(actual == expected))
    report["parent_run_id"] = parent_run
    report["champion_params"] = parents[0]["params"]
    report["challenger_params"] = challenger["params"]
    report["evaluation_window"] = actual
    report["live_promoted"] = False
    report["paper_promoted"] = False
    return report
