import ast
from app.db.client import get_client


def _parse_embedding(raw):
    """Supabase sometimes returns pgvector columns as a string
    like '[0.1,0.2,...]' instead of a native list -- normalize both cases."""
    if isinstance(raw, str):
        return ast.literal_eval(raw)
    return raw


def fetch_candidate_embeddings(institution_id: str, session_id: str):
    """Per spec Section 7 Guardrail 3: matching must be scoped to the
    session's class roster via class_enrollments, never the full
    institution table.

    Also enforces Guardrail 13: a student's status is checked here so a
    stale enrollment row for an inactive/graduated/transferred student
    can't cause a false match."""
    client = get_client()

    session = client.table("class_sessions").select("class_id").eq("id", session_id).execute()
    if not session.data or not session.data[0]["class_id"]:
        return [], []

    class_id = session.data[0]["class_id"]

    enrollments = (
        client.table("class_enrollments")
        .select("student_id")
        .eq("class_id", class_id)
        .eq("status", "active")
        .execute()
    )
    enrolled_ids = [row["student_id"] for row in enrollments.data]
    if not enrolled_ids:
        return [], []

    active = (
        client.table("students")
        .select("id")
        .eq("institution_id", institution_id)
        .eq("status", "active")
        .in_("id", enrolled_ids)
        .execute()
    )
    student_ids = [row["id"] for row in active.data]
    if not student_ids:
        return [], []

    biometrics = (
        client.table("student_biometrics")
        .select("student_id, face_embedding")
        .in_("student_id", student_ids)
        .execute()
    )
    ids = [row["student_id"] for row in biometrics.data]
    embeddings = [_parse_embedding(row["face_embedding"]) for row in biometrics.data]
    return ids, embeddings
