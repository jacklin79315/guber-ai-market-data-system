import unittest
from p3.training_data_quality import validate_training_history
from p3.ai_decision_model import FEATURE_COLUMNS

def sample():
    candles=[{"open_time":i*900000,"close_time":(i+1)*900000-1,
              "open":100,"high":101,"low":99,"close":100} for i in range(3)]
    features=[{"close_time":c["close_time"],"close_price":100,
               **{key: 1.0 for key in FEATURE_COLUMNS}} for c in candles]
    return candles,features

class DataQualityTests(unittest.TestCase):
    def test_valid(self):
        c,f=sample()
        self.assertEqual(validate_training_history(c,f,"15m",required_start_ms=0)["matched"],3)
    def test_warmup_prefix_is_allowed(self):
        c,f=sample()
        result=validate_training_history(c,f[1:],"15m",required_start_ms=0)
        self.assertEqual(result["matched"],2)
        self.assertEqual(result["first_usable_feature_ms"],c[1]["close_time"])
    def test_internal_feature_gap_rejected(self):
        c,f=sample()
        with self.assertRaisesRegex(ValueError,"missing feature rows"):
            validate_training_history(c,[f[0],f[2]],"15m",required_start_ms=0)
    def test_gap(self):
        c,f=sample()
        with self.assertRaisesRegex(ValueError,"missing, duplicate"):
            validate_training_history([c[0],c[2]],f,"15m",required_start_ms=0)
    def test_missing_feature(self):
        c,f=sample()
        with self.assertRaisesRegex(ValueError,"missing feature rows"):
            validate_training_history(c,f[:-1],"15m",required_start_ms=0)
    def test_price_mismatch(self):
        c,f=sample();f[1]["close_price"]=101
        with self.assertRaisesRegex(ValueError,"feature price"):
            validate_training_history(c,f,"15m",required_start_ms=0)

if __name__=="__main__":
    unittest.main()
