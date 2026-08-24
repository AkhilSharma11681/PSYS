from app.db.client import get_client


def get_best_evidence_photo(session_id: str, student_id: str) -> str | None:
    """Spec Phase F: disputes attach evidence photos. Picks the highest-
    quality observation with a stored photo for this student/session --
    the strongest single piece of evidence to show an admin resolving
    the dispute, not just the first/last one."""
    client = get_client()
    obs = (client.table("attendance_observations")
           .select("evidence_photo_url, quality_score")
           .eq("session_id", session_id)
           .eq("student_id", student_id)
           .not_.is_("evidence_photo_url", "null")
           .order("quality_score", desc=True)
           .limit(1)
           .execute())
    if not obs.data:
        return None
    return obs.data[0]["evidence_photo_url"]


def create_dispute(institution_id: str, final_attendance_id: str, session_id: str,
                    student_id: str, reason: str | None = None) -> dict:
    """Creates a dispute row, auto-attaching the best available evidence
    photo so the student/admin never has to manually find or upload one."""
    client = get_client()
    evidence_url = get_best_evidence_photo(session_id, student_id)

    result = client.table("disputes").insert({
        "institution_id": institution_id,
        "final_attendance_id": final_attendance_id,
        "student_id": student_id,
        "reason": reason,
        "evidence_photo_url": evidence_url,
        "status": "pending",
    }).execute()
    return result.data[0]
