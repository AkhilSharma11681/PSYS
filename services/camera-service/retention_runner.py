import time
import traceback
from datetime import datetime, timezone
from app.db.client import get_client
from app.privacy.retention import cleanup_expired_evidence_photos

TICK_INTERVAL_SECONDS = 3600  # once an hour is plenty for a retention sweep


def run_forever():
    print(f"[{datetime.now(timezone.utc).isoformat()}] Retention runner started, "
          f"tick every {TICK_INTERVAL_SECONDS}s")
    client = get_client()

    while True:
        try:
            institutions = client.table("institutions").select("id").execute()
            for inst in institutions.data:
                result = cleanup_expired_evidence_photos(inst["id"])
                if result["photos_deleted"] or result["errors"]:
                    print(f"[{datetime.now(timezone.utc).isoformat()}] "
                          f"institution {inst['id']}: {result}")
        except Exception:
            print(f"[{datetime.now(timezone.utc).isoformat()}] Retention tick failed, "
                  f"continuing on next interval:")
            traceback.print_exc()

        time.sleep(TICK_INTERVAL_SECONDS)


if __name__ == "__main__":
    run_forever()
