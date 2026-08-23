from datetime import datetime, timezone
from app.db.client import get_client
from app.finalization.boundaries import detect_session_boundaries
from app.finalization.gap_check import compute_student_presence
from app.finalization.exceptions import fetch_exception_windows_by_student


def finalize_session(session_id: str) -> dict:
    """Top-level Phase E entry point (spec Section 5). Idempotency guard
    first -- an atomic update on finalized_at claims the job; no row back
    means another worker/retry already has it, exit immediately."""
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
        "processing_status": boundaries["processing_status"],
    }).eq("id", session_id).execute()

    if not boundaries["quorum_reached"]:
        return {"status": "quorum_not_reached", "boundaries": boundaries, "results": []}

    roster = client.rpc("derive_session_roster", {"p_session_id": session_id}).execute()
    student_ids = [row["student_id"] for row in roster.data]

    exceptions_by_student = fetch_exception_windows_by_student(session_id)

    results = []
    rows_to_persist = []
    finalized_at = datetime.now(timezone.utc).isoformat()

    for student_id in student_ids:
        presence = compute_student_presence(
            session_id, student_id, boundaries["actual_start"], boundaries["actual_end"],
            exception_windows=exceptions_by_student.get(student_id, []),
        )
        results.append({"student_id": student_id, **presence})
        rows_to_persist.append({
            "institution_id": boundaries["institution_id"],
            "session_id": session_id,
            "student_id": student_id,
            "presence_score": presence["presence_score"],
            "status": presence["status"],
            "exception_applied": bool(exceptions_by_student.get(student_id)),
            "finalized_at": finalized_at,
        })

    if rows_to_persist:
        client.table("final_attendance").upsert(
            rows_to_persist, on_conflict="session_id,student_id"
        ).execute()

    return {"status": "finalized", "boundaries": boundaries, "results": results}
