from datetime import datetime, timezone, timedelta
from app.db.client import get_client

DAY_CODES = {0: "MON", 1: "TUE", 2: "WED", 3: "THU", 4: "FRI", 5: "SAT", 6: "SUN"}
LEAD_MINUTES = 30  # generate a session's row this far before its scheduled_start


def _parse_recurrence(recurrence: str):
    """'MON,WED,FRI 10:00-11:00' -> ({'MON','WED','FRI'}, '10:00', '11:00')"""
    days_part, time_part = recurrence.split(" ", 1)
    days = set(d.strip() for d in days_part.split(","))
    start_str, end_str = time_part.split("-")
    return days, start_str.strip(), end_str.strip()


def generate_due_sessions(now: datetime | None = None) -> list[dict]:
    """Spec Section 5, Phase B/C: 'A scheduler generates a class_sessions
    row shortly before each classes recurrence is due to start.'

    Meant to run on a short interval (e.g. every 5 min via cron). Idempotent
    by construction: skips a class if a session already exists for today's
    date, so re-running the same minute twice never double-creates.
    """
    now = now or datetime.now(timezone.utc)
    client = get_client()
    today_code = DAY_CODES[now.weekday()]

    classes = client.table("classes").select("*").eq("is_active", True).execute()
    created = []

    for cls in classes.data:
        if not cls.get("recurrence"):
            continue
        try:
            days, start_str, end_str = _parse_recurrence(cls["recurrence"])
        except (ValueError, AttributeError):
            continue  # malformed recurrence -- skip rather than crash the whole run

        if today_code not in days:
            continue

        start_hour, start_min = map(int, start_str.split(":"))
        end_hour, end_min = map(int, end_str.split(":"))
        scheduled_start = now.replace(hour=start_hour, minute=start_min, second=0, microsecond=0)
        scheduled_end = now.replace(hour=end_hour, minute=end_min, second=0, microsecond=0)

        if now < scheduled_start - timedelta(minutes=LEAD_MINUTES):
            continue  # too early, not due yet
        if now > scheduled_end:
            continue  # already past -- don't backfill a missed session

        existing = (client.table("class_sessions")
                    .select("id")
                    .eq("class_id", cls["id"])
                    .eq("scheduled_start", scheduled_start.isoformat())
                    .execute())
        if existing.data:
            continue  # already generated -- idempotent no-op

        row = client.table("class_sessions").insert({
            "institution_id": cls["institution_id"],
            "class_id": cls["id"],
            
            "scheduled_start": scheduled_start.isoformat(),
            "scheduled_end": scheduled_end.isoformat(),
            "status": "scheduled",
            "processing_status": "pending",
        }).execute()
        created.append(row.data[0])

    return created
