"""Build the unchanged handoff seed; refuse to overwrite an existing database."""

import argparse
import sqlite3
from pathlib import Path


def build_database(target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation prevents accidental replacement of a database.
    with target.open("xb"):
        pass
    try:
        with sqlite3.connect(target) as connection:
            connection.executescript(Path(__file__).with_name("seed_eisa.sql").read_text())
            assert connection.execute("PRAGMA integrity_check").fetchone() == ("ok",)
        target.chmod(0o444)
    except Exception:
        target.unlink(missing_ok=True)
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path(__file__).with_name("eisa_demo.db"))
    build_database(parser.parse_args().output)
