import csv
import io
from app.db.client import get_client


def export_session_csv(session_id: str) -> str:
    """Spec Section 5, Phase G: 'CSV export always available (universal
    fallback, no exceptions).' Pulls final_attendance for one session --
    the materialized, human-readable result, not raw observations."""
    client = get_client()
    rows = (client.table("final_attendance")
            .select("student_id, status, presence_score, exception_applied, finalized_at")
            .eq("session_id", session_id)
            .order("student_id")
            .execute())

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["student_id", "status", "presence_score", "exception_applied", "finalized_at"])
    for row in rows.data:
        writer.writerow([
            row["student_id"], row["status"], row["presence_score"],
            row["exception_applied"], row["finalized_at"],
        ])
    return output.getvalue()
