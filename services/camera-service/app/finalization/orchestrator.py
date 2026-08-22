from datetime import datetime, timezone
from app.db.client import get_client
from app.finalization.boundaries import detect_session_boundaries
from app.finalization.gap_check import compute_student_presence
from app.finalization.exceptions import fetch_exception_windows_by_student


def finalize_session(session_id: str) -> dict:
    """Top-level Phase E entry point (spec Section 5). Idempotency guard
    first -- an atomic update on finalized_at claims the job; no row back
    means another worker/retry already has it, exit immediately.

    NOTE: final_attendance table doesn't exist yet (teammate's schema
    pending) -- returns computed results instead of persisting them."""
    client = get_client()

    claim = (client.table("class_sessions")
             .update({"finalized_at": datetime.now(timezone.utc).isoformat()})
             .eq("id", session_id)
             .is_("finalized_at", "null")
             .execute())

    if not claim.data:
        return {"status": "already_finalized", "results": []}

    boundaries = detect_session_boundaries(session_id)
    client.table("class_sessions").update({
        "actual_start": boundaries["actual_start"],
        "actual_end": boundaries["actual_end"],
        "camera_status": boundaries["camera_status"],
    }).eq("id", session_id).execute()

    if not boundaries["quorum_reached"]:
        return {"status": "quorum_not_reached", "boundaries": boundaries, "results": []}

    roster = client.rpc("derive_session_roster", {"p_session_id": session_id}).execute()
    student_ids = [row["student_id"] for row in roster.data]

    exceptions_by_student = fetch_exception_windows_by_student(session_id)

    results = []
    for student_id in student_ids:
        presence = compute_student_presence(
            session_id, student_id, boundaries["actual_start"], boundaries["actual_end"],
            exception_windows=exceptions_by_student.get(student_id, []),
        )
        results.append({"student_id": student_id, **presence})

    return {"status": "finalized", "boundaries": boundaries, "results": results}
