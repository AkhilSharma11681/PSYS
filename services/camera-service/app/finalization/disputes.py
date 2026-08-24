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
    photo. Enforces spec's 24-48hr dispute window (attendance_config.
    dispute_window_hours) against final_attendance.finalized_at."""
    from datetime import datetime, timezone
    from app.recognition.config import get_recognition_config
    client = get_client()

    fa = client.table("final_attendance").select("finalized_at").eq("id", final_attendance_id).execute()
    if not fa.data:
        raise ValueError("final_attendance row not found")

    config = get_recognition_config(institution_id)
    window_hours = config.get("dispute_window_hours", 48)
    finalized_at = datetime.fromisoformat(fa.data[0]["finalized_at"])
    hours_elapsed = (datetime.now(timezone.utc) - finalized_at).total_seconds() / 3600
    if hours_elapsed > window_hours:
        raise ValueError(f"dispute_window_expired: {hours_elapsed:.1f}h elapsed, window is {window_hours}h")

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


def resolve_dispute(dispute_id: str, new_status: str, resolved_status_for_attendance: str | None = None) -> dict:
    """new_status: 'approved' or 'rejected'. If approved and a corrected
    attendance status is given, final_attendance is updated too -- spec's
    audit_logs requirement means this correction must be traceable, not
    a silent overwrite of an already-finalized row."""
    if new_status not in ("approved", "rejected"):
        raise ValueError(f"invalid status: {new_status}")

    from datetime import datetime, timezone
    client = get_client()

    dispute = client.table("disputes").select("*").eq("id", dispute_id).execute()
    if not dispute.data:
        raise ValueError("dispute not found")
    d = dispute.data[0]

    updated = client.table("disputes").update({
        "status": new_status,
        "resolved_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", dispute_id).execute()

    # Every dispute resolution is a human decision -- logged regardless
    # of whether it also corrects final_attendance (spec: 'every status
    # change a human makes is recorded').
    client.table("audit_logs").insert({
        "institution_id": d["institution_id"],
        "action": "dispute_resolved",
        "entity_type": "dispute",
        "entity_id": dispute_id,
        "metadata": {"old_status": d["status"], "new_status": new_status},
    }).execute()

    if new_status == "approved" and resolved_status_for_attendance:
        old_row = client.table("final_attendance").select("status").eq("id", d["final_attendance_id"]).execute()
        old_status = old_row.data[0]["status"] if old_row.data else None

        client.table("final_attendance").update({
            "status": resolved_status_for_attendance,
        }).eq("id", d["final_attendance_id"]).execute()

        client.table("audit_logs").insert({
            "institution_id": d["institution_id"],
            "action": "dispute_approved_attendance_corrected",
            "entity_type": "final_attendance",
            "entity_id": d["final_attendance_id"],
            "metadata": {"old_status": old_status, "new_status": resolved_status_for_attendance, "dispute_id": dispute_id},
        }).execute()

    return updated.data[0]
