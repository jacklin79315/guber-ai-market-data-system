import unittest
from unittest.mock import patch
from p3.feedback_candidate_research import run_feedback_candidate_research
from p3.autonomous_experiment_plan import assess_candidate_research
from p3.walk_forward_diagnostics import audit_prediction_coverage, trade_prediction_rows, classify_research_evidence, audit_severe_drawdown, diagnose_trade_prediction_outcomes
from p3.feedback_candidate_generator import DEFAULT_LAYER_PARAMS, next_feedback_candidate, next_structure_candidate


def row(dd=10):
    return {"trial_index": 1, "params": dict(DEFAULT_LAYER_PARAMS),
            "metrics": {"annualized_return_percent": -5,
                        "win_rate_percent": 60, "mean_score_q": 65,
                        "normal_closed_trades": 10,
                        "max_close_to_close_drawdown_percent": dd,
                        "ambiguous_exit_count": 0},
            "eligible_trade_diagnosis": {"by_direction": {
                "LONG": {"closed": 10, "win_rate_percent": 30,
                         "net_pnl": -50}}}}


class CandidateGenerationTests(unittest.TestCase):
    def test_batch_stops_at_baseline_without_model_evidence(self):
        candles = [{"close_time": 10, "close": 100}]
        features = [{"close_time": 10, "close_price": 100}]
        fake = {"research_trading_metrics": row()["metrics"],
                "research_evidence_status": {"status": "WAIT"},
                "training_checkpoints": []}
        with patch("p3.feedback_candidate_research.replay_walk_forward_research",
                   return_value=fake) as replay:
            result = run_feedback_candidate_research(
                candles, features, "INTRADAY", (1, 20),
                symbol="BTCUSDT", fee_rate=0.001,
                slippage_rate=0.001, max_new_candidates=10)
        self.assertEqual(replay.call_count, 1)
        self.assertEqual(result["new_candidates_run"], 0)
        self.assertEqual(result["stop_reason"], "WAIT_FOR_MODEL_EVIDENCE")
        self.assertEqual(result["next_action"], "WAIT_FOR_EVIDENCE")
        self.assertEqual(len(result["decision_log"]), replay.call_count)
        self.assertEqual(result["research_summary"]["candidate_trials"], 0)
        self.assertEqual(result["research_summary"]["inconclusive_candidates"], 0)

    def test_batch_stops_after_inconclusive_candidate(self):
        candles = [{"close_time": 10, "close": 100}]
        features = [{"close_time": 10, "close_price": 100}]
        def fake_replay(*args, **kwargs):
            fake_replay.calls += 1
            evidence = ("EVIDENCE_READY_FOR_COMPARATIVE_RESEARCH"
                        if fake_replay.calls == 1 else "WAIT")
            return {"research_trading_metrics": dict(row()["metrics"]),
                    "research_evidence_status": {"status": evidence},
                    "direction_prediction_diagnostics": {
                        "matched_predictions": 10, "direction_error_rate_percent": 40},
                    "structure_prediction_diagnostics": {
                        "matched_predictions": 10, "mean_absolute_range_error": 0.02},
                    "training_checkpoints": []}
        fake_replay.calls = 0
        with patch("p3.feedback_candidate_research.replay_walk_forward_research",
                   side_effect=fake_replay):
            result = run_feedback_candidate_research(
                candles, features, "INTRADAY", (1, 20),
                symbol="BTCUSDT", fee_rate=0.001,
                slippage_rate=0.001, max_new_candidates=10)
        self.assertEqual(fake_replay.calls, 2)
        self.assertEqual(result["stop_reason"], "WAIT_FOR_MODEL_EVIDENCE")
        self.assertEqual(result["new_candidates_run"], 1)
        self.assertEqual(result["research_summary"]["candidate_trials"], 1)
        self.assertEqual(result["research_summary"]["inconclusive_candidates"], 1)

    def test_severe_drawdown_can_explore_but_not_qualify(self):
        from p3.walk_forward_feedback import feedback_rank, exploration_rank
        from p3.feedback_candidate_generator import next_feedback_candidate
        metrics = dict(row(dd=90)["metrics"], ambiguous_exit_count=0)
        self.assertIsNone(feedback_rank(metrics))
        self.assertIsNotNone(exploration_rank(metrics))
        history = [{"trial_index": 1, "params": dict(DEFAULT_LAYER_PARAMS),
                    "metrics": metrics,
                    "direction_prediction_diagnostics": {
                        "matched_predictions": 100,
                        "direction_error_rate_percent": 55}}]
        proposal = next_feedback_candidate(history)
        self.assertEqual(proposal["status"], "CANDIDATE_READY")
        self.assertFalse(proposal["eligible_for_promotion"])

    def test_severe_drawdown_structure_candidate_remains_research_only(self):
        from p3.feedback_candidate_generator import next_structure_candidate
        source = {"trial_index": 1, "params": dict(DEFAULT_LAYER_PARAMS),
                  "metrics": dict(row(dd=90)["metrics"]),
                  "structure_prediction_diagnostics": {
                      "matched_predictions": 100,
                      "mean_absolute_range_error": 0.02}}
        proposal = next_structure_candidate([source])
        self.assertEqual(proposal["status"], "CANDIDATE_READY")
        self.assertEqual(proposal["target_layer"], "STRUCTURE")
        self.assertFalse(proposal["eligible_for_promotion"])
        self.assertEqual(sum(proposal["candidate"][key] != source["params"][key]
                             for key in source["params"]), 1)

    def test_severe_drawdown_runs_bounded_candidate_research(self):
        candles = [{"close_time": 10, "close": 100}]
        features = [{"close_time": 10, "close_price": 100}]
        def fake_replay(*args, **kwargs):
            return {"research_trading_metrics": dict(row(dd=90)["metrics"]),
                    "research_evidence_status": {
                        "status": "EVIDENCE_READY_FOR_COMPARATIVE_RESEARCH"},
                    "direction_prediction_diagnostics": {
                        "matched_predictions": 100, "direction_error_rate_percent": 55},
                    "training_checkpoints": []}
        with patch("p3.feedback_candidate_research.replay_walk_forward_research",
                   side_effect=fake_replay) as replay:
            result = run_feedback_candidate_research(
                candles, features, "INTRADAY", (1, 20),
                symbol="BTCUSDT", fee_rate=0.001, slippage_rate=0.001,
                max_new_candidates=2)
        self.assertEqual(replay.call_count, 3)
        self.assertEqual(result["new_candidates_run"], 2)
        self.assertTrue(all(not t["eligible_for_promotion"]
                            for t in result["iterations"]))
        self.assertTrue(all(t["feedback_rank"] is None
                            for t in result["iterations"]))

    def test_batch_rejects_budget_above_ten(self):
        with self.assertRaises(ValueError):
            run_feedback_candidate_research([], [], "INTRADAY", (1, 20),
                symbol="BTCUSDT", fee_rate=0.001,
                slippage_rate=0.001, max_new_candidates=11)

    def test_comparable_research_improvement_is_not_promotion(self):
        anchor, candidate = row(), row()
        context = {"strategy": "INTRADAY", "research_window": [1, 2],
                   "symbol": "BTCUSDT", "fee_rate": 0.001,
                   "slippage_rate": 0.001, "data_fingerprint": "same",
                   "research_evidence_status": {
                       "status": "EVIDENCE_READY_FOR_COMPARATIVE_RESEARCH"}}
        anchor.update(context)
        candidate.update(context)
        candidate["metrics"] = dict(candidate["metrics"], annualized_return_percent=-4)
        result = assess_candidate_research(anchor, candidate)
        self.assertEqual(result["status"], "IMPROVED_IN_RESEARCH_ONLY")
        self.assertFalse(result["independent_validation_performed"])
        self.assertFalse(result["eligible_for_promotion"])

    def test_research_assessment_waits_for_model_evidence(self):
        anchor = row()
        candidate = row()
        context = {"strategy": "INTRADAY", "research_window": [1, 2],
                   "symbol": "BTCUSDT", "fee_rate": 0.001,
                   "slippage_rate": 0.001, "data_fingerprint": "same"}
        anchor.update(context)
        candidate.update(context)
        candidate["metrics"] = dict(candidate["metrics"], annualized_return_percent=-4)
        result = assess_candidate_research(anchor, candidate)
        self.assertEqual(result["status"], "WAIT")
        self.assertFalse(result["eligible_for_promotion"])

    def test_candidate_rejected_on_lower_research_rank(self):
        anchor, candidate = row(), row()
        context = {"strategy": "INTRADAY", "research_window": [1, 2],
                   "symbol": "BTCUSDT", "fee_rate": 0.001,
                   "slippage_rate": 0.001, "data_fingerprint": "same",
                   "research_evidence_status": {
                       "status": "EVIDENCE_READY_FOR_COMPARATIVE_RESEARCH"}}
        anchor.update(context)
        candidate.update(context)
        candidate["metrics"] = dict(candidate["metrics"], annualized_return_percent=-6)
        self.assertEqual(assess_candidate_research(anchor, candidate)["status"],
                         "REJECTED_IN_RESEARCH")

    def test_evidence_classifier_waits_for_complete_coverage(self):
        result = classify_research_evidence(
            {"entry_events": 2, "matched_both": 1}, {}, {}, [])
        self.assertEqual(result["status"], "WAIT")
        self.assertFalse(result["eligible_for_candidate_selection"])

    def test_evidence_classifier_requires_both_matured_models(self):
        result = classify_research_evidence(
            {"entry_events": 1, "matched_both": 1},
            {"status": "RESEARCH_DIRECTION_EVALUATION",
             "matched_predictions": 5, "direction_error_rate_percent": 40},
            {"status": "INSUFFICIENT_STRUCTURE_PREDICTION_EVIDENCE"},
            [{"forecast_pair_complete": True}])
        self.assertEqual(result["reason"], "INSUFFICIENT_MATURED_MODEL_LABELS")

    def test_trade_prediction_rows_join_by_decision_time(self):
        replay = {"events": [
            {"type": "ENTRY", "lot_id": 4, "decision_time_ms": 10, "side": "LONG"},
            {"type": "EXIT", "lot_id": 4, "entry_price": 100,
             "exit_price": 103, "net_pnl": 3, "reason": "TP"},
            {"type": "BACKTEST_END_SETTLEMENT", "lot_id": 5}]}
        rows = trade_prediction_rows(
            replay, [{"decision_time_ms": 10, "probability_up": 0.7}],
            [{"decision_time_ms": 10, "predicted_upper_bound": 104,
              "predicted_lower_bound": 98}])
        self.assertEqual(len(rows), 1)
        self.assertTrue(rows[0]["forecast_pair_complete"])
        self.assertEqual(rows[0]["probability_up"], 0.7)

    def test_forecast_coverage_counts_missing_entries(self):
        replay = {"events": [{"type": "ENTRY", "decision_time_ms": 10},
                             {"type": "ENTRY", "decision_time_ms": 20}]}
        audit = audit_prediction_coverage(
            replay, [{"decision_time_ms": 10}], [{"decision_time_ms": 20}])
        self.assertEqual(audit["entry_events"], 2)
        self.assertEqual(audit["matched_both"], 0)
        self.assertEqual(audit["missing_direction"], 1)
        self.assertFalse(audit["eligible_for_candidate_selection"])

    def test_severe_drawdown_audit_cannot_enable_feedback(self):
        replay = {"metrics": {"max_close_to_close_drawdown_percent": 91.6,
                              "signal_counts": {"INSUFFICIENT_CASH": 6264},
                              "ambiguous_exit_count": 4},
                  "events": [{"type": "EXIT", "side": "LONG",
                              "net_pnl": -10, "reason": "SL"}]}
        audit = audit_severe_drawdown(replay)
        self.assertEqual(audit["status"], "SEVERE_DRAWDOWN_AUDIT_ONLY")
        self.assertEqual(audit["by_direction"]["LONG"]["losses"], 1)
        self.assertEqual(audit["by_exit_reason"]["SL"]["closed"], 1)
        self.assertEqual(audit["gross_losing_pnl"], -10)
        self.assertEqual(audit["signal_counts"]["INSUFFICIENT_CASH"], 6264)
        self.assertFalse(audit["eligible_for_candidate_selection"])
        self.assertIsNone(audit_severe_drawdown({
            "metrics": {"max_close_to_close_drawdown_percent": 39},
            "events": []}))

    def test_severe_audit_reconciles_boundary_settlement(self):
        replay = {"metrics": {
            "max_close_to_close_drawdown_percent": 63,
            "realized_net_pnl": -104,
            "normal_trades_net_pnl": -100,
            "backtest_end_fees_net_pnl": -4},
            "events": [{"type": "EXIT", "side": "SHORT",
                        "net_pnl": -100, "reason": "SL"},
                       {"type": "BACKTEST_END_SETTLEMENT", "net_pnl": -4}]}
        audit = audit_severe_drawdown(replay)
        self.assertEqual(audit["net_pnl_reconciliation_gap"], -4)
        self.assertEqual(audit["normal_trades_reconciliation_gap"], 0)
        self.assertEqual(audit["realized_pnl_after_boundary_reconciliation_gap"], 0)
        self.assertFalse(audit["eligible_for_candidate_selection"])

    def test_trade_forecast_alignment_is_descriptive_only(self):
        trades = [
            {"forecast_pair_complete": True, "side": "LONG",
             "probability_up": 0.8, "net_pnl": -10},
            {"forecast_pair_complete": True, "side": "SHORT",
             "probability_up": 0.8, "net_pnl": 4},
            {"forecast_pair_complete": False, "side": "LONG",
             "probability_up": None, "net_pnl": 2}]
        result = diagnose_trade_prediction_outcomes(trades)
        self.assertEqual(result["matched_trades"], 2)
        self.assertEqual(result["missing_or_invalid_trades"], 1)
        self.assertEqual(result["by_side_and_direction_alignment"]["LONG:ALIGNED"]["net_pnl"], -10)
        self.assertEqual(result["by_side_and_direction_alignment"]["SHORT:CONTRARY"]["net_pnl"], 4)
        self.assertFalse(result["eligible_for_candidate_selection"])

    def test_structure_association_groups_entry_range(self):
        from p3.walk_forward_diagnostics import diagnose_trade_structure_outcomes
        trades = [
            {"forecast_pair_complete": True, "side": "LONG", "entry_price": 100,
             "predicted_lower_bound": 90, "predicted_upper_bound": 110, "net_pnl": 5},
            {"forecast_pair_complete": True, "side": "SHORT", "entry_price": 120,
             "predicted_lower_bound": 90, "predicted_upper_bound": 110, "net_pnl": -3},
            {"forecast_pair_complete": True, "side": "LONG", "entry_price": 100,
             "predicted_lower_bound": 110, "predicted_upper_bound": 90, "net_pnl": 2}]
        result = diagnose_trade_structure_outcomes(trades)
        self.assertEqual(result["matched_trades"], 2)
        self.assertEqual(result["missing_or_invalid_trades"], 1)
        self.assertEqual(result["by_side_and_entry_range"]["LONG:WITHIN_PREDICTED_RANGE"]["net_pnl"], 5)
        self.assertEqual(result["by_side_and_entry_range"]["SHORT:ABOVE_PREDICTED_RANGE"]["net_pnl"], -3)
        self.assertFalse(result["eligible_for_candidate_selection"])

    def test_matured_trade_forecast_audit_excludes_unmatured_labels(self):
        from p3.walk_forward_diagnostics import diagnose_trade_matured_forecasts
        candles = [{"close_time": i, "close": 100 + i,
                    "high": 101 + i, "low": 99 + i} for i in range(1, 6)]
        trades = [
            {"forecast_pair_complete": True, "decision_time_ms": 1,
             "side": "LONG", "probability_up": 0.8,
             "predicted_lower_bound": 98, "predicted_upper_bound": 104,
             "net_pnl": -2, "planned_rr": 2},
            {"forecast_pair_complete": True, "decision_time_ms": 4,
             "side": "LONG", "probability_up": 0.8,
             "predicted_lower_bound": 98, "predicted_upper_bound": 110,
             "net_pnl": 2}]
        result = diagnose_trade_matured_forecasts(trades, candles, 2, (1, 5))
        self.assertEqual(result["matched_trades"], 1)
        self.assertEqual(result["skipped"]["unmatured_horizon"], 1)
        group = result["by_direction_and_range_accuracy"]["DIRECTION_CORRECT:RANGE_COVERED"]
        self.assertEqual(group["net_pnl"], -2)
        self.assertEqual(group["mean_planned_rr"], 2)
        self.assertFalse(result["eligible_for_candidate_selection"])

    def test_rejects_disqualified_feedback(self):
        self.assertEqual(next_feedback_candidate([row(41)])["status"],
                         "MISSING_DIRECTION_PREDICTION_EVIDENCE")

    def test_direction_requires_prediction_evidence(self):
        self.assertEqual(next_feedback_candidate([row()])["status"],
                         "MISSING_DIRECTION_PREDICTION_EVIDENCE")

    def test_structure_requires_evidence(self):
        self.assertEqual(next_structure_candidate([row()])["status"],
                         "MISSING_STRUCTURE_PREDICTION_EVIDENCE")

    def test_structure_changes_only_structure_parameter(self):
        source = row()
        source["structure_prediction_diagnostics"] = {
            "matched_predictions": 10, "mean_absolute_range_error": 0.02}
        choice = next_structure_candidate([source])
        self.assertEqual(choice["status"], "CANDIDATE_READY")
        self.assertEqual(choice["target_layer"], "STRUCTURE")
        self.assertTrue(choice["changed_field"].startswith("structure_"))

    def test_stop_events_alone_cannot_trigger_structure_tuning(self):
        source = row()
        source["eligible_trade_diagnosis"]["by_direction"]["LONG"]["stop_losses"] = 10
        self.assertEqual(next_structure_candidate([source])["status"],
                         "MISSING_STRUCTURE_PREDICTION_EVIDENCE")

    def test_direction_candidates_do_not_repeat_parameters(self):
        history = []
        observed = set()
        for index in range(8):
            current = row()
            current["trial_index"] = index + 1
            current["direction_prediction_diagnostics"] = {
                "matched_predictions": 10, "direction_error_rate_percent": 40.0}
            if index:
                choice = next_feedback_candidate(history)
                self.assertEqual(choice["status"], "CANDIDATE_READY")
                current["params"] = choice["candidate"]
            key = tuple(sorted(current["params"].items()))
            self.assertNotIn(key, observed)
            observed.add(key)
            history.append(current)
        self.assertEqual(len(observed), 8)
        self.assertEqual(next_feedback_candidate(history)["status"],
                         "APPROVED_NEIGHBORHOOD_EXHAUSTED")

    def test_changes_only_one_approved_parameter(self):
        source = row()
        source["direction_prediction_diagnostics"] = {
            "matched_predictions": 10, "direction_error_rate_percent": 40.0}
        choice = next_feedback_candidate([source])
        self.assertEqual(choice["status"], "CANDIDATE_READY")
        changed = [key for key in DEFAULT_LAYER_PARAMS
                   if choice["candidate"][key] != DEFAULT_LAYER_PARAMS[key]]
        self.assertEqual(changed, [choice["changed_field"]])
        self.assertEqual(choice["target_layer"], "DIRECTION")


if __name__ == "__main__":
    unittest.main()
