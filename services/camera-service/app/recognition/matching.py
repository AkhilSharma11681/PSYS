import ast
from app.db.client import get_client


def _parse_embedding(raw):
    """Supabase sometimes returns pgvector columns as a string
    like '[0.1,0.2,...]' instead of a native list -- normalize both cases."""
    if isinstance(raw, str):
        return ast.literal_eval(raw)
    return raw


def fetch_candidate_embeddings(institution_id: str, session_id: str):
    """Per spec Section 7 Guardrail 3 (class-scoped matching) AND Section 1
    (check-in-narrowed monitoring roster). Calls the shared SQL function
    derive_session_roster() -- same logic apps/web uses -- instead of
    duplicating roster-building here (matches the embed() reuse pattern)."""
    client = get_client()

    roster = client.rpc("derive_session_roster", {"p_session_id": session_id}).execute()
    enrolled_ids = [row["student_id"] for row in roster.data]
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
