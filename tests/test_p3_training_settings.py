import unittest
from p3.training_settings import load_training_settings

class TestTrainingSettings(unittest.TestCase):
    def test_valid_years(self):
        for days, years in [(365,1),(730,2),(1095,3)]:
            db=lambda method,table,params:[{"config":{"symbol":"BTCUSDT","lookback_days":days}}]
            self.assertEqual(load_training_settings(db),{"symbol":"BTCUSDT","years":years})
    def test_reject_unsupported_days(self):
        db=lambda method,table,params:[{"config":{"symbol":"BTCUSDT","lookback_days":400}}]
        with self.assertRaisesRegex(ValueError,"lookback_days"):
            load_training_settings(db)
    def test_reject_unsupported_symbol(self):
        db=lambda method,table,params:[{"config":{"symbol":"BAD","lookback_days":365}}]
        with self.assertRaisesRegex(ValueError,"symbol"):
            load_training_settings(db)
    def test_missing_config_fails_closed(self):
        with self.assertRaisesRegex(ValueError,"missing"):
            load_training_settings(lambda *args: [])
if __name__=="__main__": unittest.main()
