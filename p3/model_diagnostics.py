"""Validation-only diagnostics for the independent direction and range models.

Diagnostic output is observational. It never selects or promotes a model.
"""
import numpy as np
from .ai_decision_model import DIRECTION_INDICES, STRUCTURE_INDICES


def diagnose_validation(model, partition):
    """Compare predicted outcomes to validation labels without holdout access."""
    X = np.asarray(partition["X"])
    if len(X) == 0:
        return {"samples": 0, "direction_accuracy_percent": None,
                "direction_brier_score": None, "upside_mae_percent": None,
                "downside_mae_percent": None}
    direction = np.asarray(model.direction.predict_proba(X[:, DIRECTION_INDICES]))
    classes = list(model.direction.classes_)
    up_prob = direction[:, classes.index(1)]
    actual = np.asarray(partition["y_direction"])
    upside = np.maximum(0, model.upside.predict(X[:, STRUCTURE_INDICES]))
    downside = np.maximum(0, model.downside.predict(X[:, STRUCTURE_INDICES]))
    return {
        "samples": int(len(X)),
        "direction_accuracy_percent": float(100 * np.mean((up_prob >= 0.5) == actual)),
        "direction_brier_score": float(np.mean((up_prob - actual) ** 2)),
        "upside_mae_percent": float(100 * np.mean(np.abs(upside - np.asarray(partition["y_up"])))),
        "downside_mae_percent": float(100 * np.mean(np.abs(downside - np.asarray(partition["y_down"])))),
    }
