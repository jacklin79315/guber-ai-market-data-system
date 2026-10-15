import unittest
from datetime import datetime, timedelta, timezone
from p3.research_lease_policy import lease_decision, next_expiry

NOW = datetime(2026, 10, 16, tzinfo=timezone.utc)

class ResearchLeasePolicyTests(unittest.TestCase):
    def test_new_claim(self):
        self.assertEqual(lease_decision(None, now=NOW)['status'], 'CLAIMABLE')

    def test_unexpired_waits(self):
        job = {'status': 'RUNNING', 'lease_expires_at': NOW + timedelta(seconds=1)}
        self.assertEqual(lease_decision(job, now=NOW)['reason'], 'active_lease')

    def test_expired_reclaims(self):
        job = {'status': 'RUNNING', 'lease_expires_at': NOW - timedelta(seconds=1)}
        self.assertEqual(lease_decision(job, now=NOW)['reason'], 'expired_lease')

    def test_terminal_waits(self):
        job = {'status': 'SUCCEEDED', 'lease_expires_at': NOW - timedelta(seconds=1)}
        self.assertEqual(lease_decision(job, now=NOW)['reason'], 'terminal_job')

    def test_missing_expiry_fails_closed(self):
        self.assertEqual(lease_decision({'status': 'RUNNING'}, now=NOW)['status'], 'WAIT')

    def test_naive_time_rejected(self):
        with self.assertRaises(ValueError):
            lease_decision(None, now=datetime(2026, 10, 16))

    def test_next_expiry(self):
        self.assertEqual(next_expiry(now=NOW, lease_seconds=60),
                         (NOW + timedelta(seconds=60)).isoformat())

if __name__ == '__main__':
    unittest.main()
