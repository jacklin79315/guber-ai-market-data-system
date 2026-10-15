"""Fail closed if the manual workflow symbol differs from the web training setting."""
import sys
from .training_settings import load_training_settings


def verify_training_symbol(db, requested_symbol):
    configured = load_training_settings(db)["symbol"]
    if configured != requested_symbol:
        raise ValueError(
            f"training symbol mismatch: requested {requested_symbol}, configured {configured}"
        )
    return configured


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: python -m p3.verify_training_symbol SYMBOL")
    from collector import db
    verify_training_symbol(db, sys.argv[1])
    print("Training symbol matches configured web settings", flush=True)


if __name__ == "__main__":
    main()
