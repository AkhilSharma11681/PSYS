from collections import defaultdict
from app.db.client import get_client


def fetch_exception_windows_by_student(session_id: str) -> dict:
    """Calls teammate's session-level get_session_exceptions() RPC once,
    groups into the per-student shape compute_student_presence() expects.
    Their RPC returns window_start/window_end (already-resolved -- never
    null, coalesced against actual_end/scheduled_end on their side)."""
    client = get_client()
    rows = client.rpc("get_session_exceptions", {"p_session_id": session_id}).execute()

    by_student = defaultdict(list)
    for row in rows.data:
        by_student[row["student_id"]].append((row["window_start"], row["window_end"]))
    return by_student
