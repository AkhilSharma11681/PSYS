from app.db.client import get_client


def get_review_queue(session_id: str) -> list[dict]:
    """Spec Phase F: 'uncertain and camera_issue sessions surface in the
    teacher dashboard with evidence photos attached.' Joins each flagged
    final_attendance row with its attendance_observations evidence photos
    for that student/session, so a dashboard can render this directly
    without its own join logic."""
    client = get_client()

    flagged = (client.table("final_attendance")
               .select("*")
               .eq("session_id", session_id)
               .in_("status", ["uncertain", "camera_issue"])
               .execute())

    results = []
    for row in flagged.data:
        obs = (client.table("attendance_observations")
               .select("captured_at, match_status, quality_score, evidence_photo_url")
               .eq("session_id", session_id)
               .eq("student_id", row["student_id"])
               .not_.is_("evidence_photo_url", "null")
               .order("captured_at")
               .execute())
        results.append({
            "student_id": row["student_id"],
            "status": row["status"],
            "presence_score": row["presence_score"],
            "evidence": obs.data,
        })
    return results
