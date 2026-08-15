import ast
from app.db.client import get_client


def _parse_embedding(raw):
    """Supabase sometimes returns pgvector columns as a string
    like '[0.1,0.2,...]' instead of a native list — normalize both cases."""
    if isinstance(raw, str):
        return ast.literal_eval(raw)
    return raw


def fetch_candidate_embeddings(institution_id: str):
    client = get_client()

    active = (
        client.table("students")
        .select("id")
        .eq("institution_id", institution_id)
        .eq("status", "active")
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
