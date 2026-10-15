import os
import unittest
from unittest.mock import patch
from p3.model_provenance import fingerprint_rows, fee_fingerprint, pinned_code_version

FIELDS = ("open_time", "close_time", "open")
ROWS = [{"open_time": 1, "close_time": 2, "open": 1.0},
        {"open_time": 3, "close_time": 4, "open": 2.0}]

class ModelProvenanceTests(unittest.TestCase):
    def test_key_order_independent(self):
        reversed_keys = [dict(reversed(list(row.items()))) for row in ROWS]
        self.assertEqual(fingerprint_rows(ROWS, FIELDS), fingerprint_rows(reversed_keys, FIELDS))
    def test_source_change_changes_fingerprint(self):
        modified = [dict(ROWS[0], open=1.1), ROWS[1]]
        self.assertNotEqual(fingerprint_rows(ROWS, FIELDS), fingerprint_rows(modified, FIELDS))
    def test_empty_rejected(self):
        with self.assertRaises(ValueError): fingerprint_rows([], FIELDS)
    def test_unordered_rejected(self):
        with self.assertRaises(ValueError): fingerprint_rows(list(reversed(ROWS)), FIELDS)
    def test_missing_field_rejected(self):
        with self.assertRaises(ValueError): fingerprint_rows([{"open_time": 1}], FIELDS)
    def test_nullable_warmup_feature_is_fingerprinted(self):
        rows = [{"open_time": 1, "close_time": 2, "open": None}]
        self.assertEqual(fingerprint_rows(rows, FIELDS), fingerprint_rows(rows, FIELDS))
        self.assertNotEqual(fingerprint_rows(rows, FIELDS), fingerprint_rows([{"open_time": 1, "close_time": 2, "open": 1.0}], FIELDS))
    def test_nonfinite_source_rejected(self):
        with self.assertRaises(ValueError):
            fingerprint_rows([{"open_time": 1, "close_time": 2, "open": float("nan")}], FIELDS)
    def test_fee_fingerprint(self):
        self.assertEqual(fee_fingerprint(0.001), fee_fingerprint(0.001))
        self.assertNotEqual(fee_fingerprint(0.001), fee_fingerprint(0.002))
    def test_code_version_requires_commit(self):
        with patch.dict(os.environ, {"GITHUB_SHA": "invalid"}):
            self.assertIsNone(pinned_code_version())
        with patch.dict(os.environ, {"GITHUB_SHA": "a" * 40}):
            self.assertEqual(pinned_code_version(), "git:" + "a" * 40)

if __name__ == "__main__":
    unittest.main()
