from datetime import datetime, timezone
from app.db.client import get_client
from app.finalization.boundaries import detect_session_boundaries
from app.finalization.gap_check import compute_student_presence


def finalize_session(session_id: str) -> dict:
    """Top-level Phase E entry point (spec Section 5).

    Idempotency guard first, exactly as spec describes: a single atomic
    update on finalized_at claims the job. If no row comes back, another
    worker (or a retry) already claimed it -- exit immediately, no
    recompute, no duplicate side effects.

    NOTE: final_attendance table doesn't exist in the DB yet (teammate's
    schema is pending the Phase 5 call) -- this returns computed results
    instead of persisting them. Once the table lands, replace the final
    return with an insert loop.
    """
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

    results = []
    for student_id in student_ids:
        presence = compute_student_presence(
            session_id, student_id, boundaries["actual_start"], boundaries["actual_end"],
            exception_windows=[],  # stub -- wire in get_session_exceptions() once ready
        )
        results.append({"student_id": student_id, **presence})

    return {"status": "finalized", "boundaries": boundaries, "results": results}
