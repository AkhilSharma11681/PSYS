import ast
import os
from app.db.client import get_client
from app.recognition.config import get_recognition_config


def _parse_embedding(raw):
    """Supabase sometimes returns pgvector columns as a string
    like '[0.1,0.2,...]' instead of a native list -- normalize both cases."""
    if isinstance(raw, str):
        return ast.literal_eval(raw)
    return raw


def fetch_candidate_embeddings(institution_id: str, session_id: str, model: str = None):
    """Per spec Section 7 Guardrail 3 (class-scoped matching) AND Section 1
    (check-in-narrowed monitoring roster). Calls the shared SQL function
    derive_session_roster() -- same logic apps/web uses -- instead of
    duplicating roster-building here (matches the embed() reuse pattern).

    Supports model-aware candidate fetching:
    - If model is 'dlib' (or default): fetches 'face_embedding' (128-D).
    - If model is 'insightface': fetches 'face_embedding_v2' (512-D).
    """
    if model is None:
        try:
            config = get_recognition_config(institution_id)
            model = config.get("recognition_model")
        except Exception:
            model = None
        if not model:
            model = os.getenv("RECOGNITION_MODEL", "dlib")

    model = str(model).lower()

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

    embedding_col = "face_embedding_v2" if model == "insightface" else "face_embedding"

    biometrics = (
        client.table("student_biometrics")
        .select(f"student_id, {embedding_col}")
        .in_("student_id", student_ids)
        .eq("is_primary", True)
        .not_.is_(embedding_col, "null")
        .execute()
    )

    ids = []
    embeddings = []
    for row in biometrics.data:
        raw_emb = row.get(embedding_col)
        if raw_emb is not None:
            parsed = _parse_embedding(raw_emb)
            ids.append(row["student_id"])
            embeddings.append(parsed)

    return ids, embeddings

