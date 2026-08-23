from collections import defaultdict
from app.db.client import get_client
from app.recognition.config import get_recognition_config


def detect_session_boundaries(session_id: str) -> dict:
    """Spec Section 5, Phase E, Step 0 (quorum detection).

    Groups matched observations by captured_at -- each distinct captured_at
    already represents exactly one capture round (capture_worker.py generates
    one shared timestamp per attempt), so no join back to capture_jobs is
    needed to find round boundaries.
    """
    client = get_client()

    session = (client.table("class_sessions")
               .select("institution_id, scheduled_start, scheduled_end")
               .eq("id", session_id).execute())
    if not session.data:
        raise ValueError("session not found")

    institution_id = session.data[0]["institution_id"]
    scheduled_start = session.data[0]["scheduled_start"]
    scheduled_end = session.data[0]["scheduled_end"]

    config = get_recognition_config(institution_id)
    quorum_fraction = config["quorum_fraction"]
    min_quorum_count = config["min_quorum_count"]

    roster = client.rpc("derive_session_roster", {"p_session_id": session_id}).execute()
    roster_size = len(roster.data)
    threshold = max(quorum_fraction * roster_size, min_quorum_count)

    matched = (client.table("attendance_observations")
               .select("captured_at, student_id")
               .eq("session_id", session_id)
               .eq("match_status", "matched")
               .execute())

    rounds = defaultdict(set)
    for row in matched.data:
        rounds[row["captured_at"]].add(row["student_id"])

    qualifying_rounds = sorted(ts for ts, students in rounds.items() if len(students) >= threshold)

    if not qualifying_rounds:
        # quorum failure is a "needs a human to look at this" signal, distinct
        # from camera_status which reflects genuine live camera_health --
        # a quorum miss doesn't necessarily mean the camera was offline
        # (spec discussion with teammate, processing_status carries this now)
        return {
            "actual_start": scheduled_start,
            "actual_end": scheduled_end,
            "quorum_reached": False,
            "processing_status": "needs_review",
        }

    return {
        "actual_start": qualifying_rounds[0],
        "actual_end": qualifying_rounds[-1],
        "quorum_reached": True,
        "processing_status": "finalized",
    }


def finalize_session_boundaries(session_id: str) -> dict:
    """Writes Step 0's result to class_sessions. Does NOT set finalized_at --
    that guard belongs to the FULL finalize (gap-check + final_attendance)."""
    client = get_client()
    result = detect_session_boundaries(session_id)
    client.table("class_sessions").update({
        "actual_start": result["actual_start"],
        "actual_end": result["actual_end"],
        "processing_status": result["processing_status"],
    }).eq("id", session_id).execute()
    return result
