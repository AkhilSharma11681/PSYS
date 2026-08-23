import time
import traceback
from datetime import datetime, timezone
from app.scheduling.lifecycle import run_tick

TICK_INTERVAL_SECONDS = 120  # spec doesn't pin an exact cadence; 2 min keeps
                              # the 30-min lead window and buffer windows
                              # responsive without hammering the DB


def run_forever():
    """Entry point for a deployed process (Railway/Render background
    worker). Guardrail 1 in spec: 'No unhandled exception in
    capture/processing may stop the scheduler' -- a single tick's failure
    (a bad recurrence string, a transient DB error, etc.) must never kill
    the loop, since every other session's lifecycle depends on this
    process staying alive."""
    print(f"[{datetime.now(timezone.utc).isoformat()}] Lifecycle runner started, "
          f"tick every {TICK_INTERVAL_SECONDS}s")

    while True:
        try:
            result = run_tick()
            if result["generated"] or result["started"] or result["finalized"]:
                print(f"[{datetime.now(timezone.utc).isoformat()}] {result}")
        except Exception:
            print(f"[{datetime.now(timezone.utc).isoformat()}] Tick failed, "
                  f"continuing on next interval:")
            traceback.print_exc()

        time.sleep(TICK_INTERVAL_SECONDS)


if __name__ == "__main__":
    run_forever()
