from app.recognition.provider import DlibFaceRecognitionProvider, find_best_match
from app.recognition.insightface_provider import InsightFaceRecognitionProvider
from app.recognition.matching import fetch_candidate_embeddings
from app.recognition.observations import log_observation
from app.recognition.config import get_recognition_config
from app.db.client import get_client

_providers = {
    "dlib": DlibFaceRecognitionProvider(),
    "insightface": InsightFaceRecognitionProvider(),
}

_session_model_cache = {}


def process_frame(frame, institution_id: str, session_id: str, frame_path: str = None, captured_at: str = None):
    """captured_at is now passed in from capture_worker (the moment the frame
    was captured), not generated here -- so a retried job produces the exact
    same captured_at, letting the idempotency constraint on
    attendance_observations(session_id, student_id, captured_at) actually
    catch duplicates (spec Guardrail 6)."""

    # 1. Determine model per-session
    if session_id not in _session_model_cache:
        client = get_client()
        session = client.table("class_sessions").select("recognition_model").eq("id", session_id).single().execute()
        model = session.data.get("recognition_model") if session.data else None
        if model:
            model = model.lower()
        if model not in _providers:
            model = "dlib"
        _session_model_cache[session_id] = model

    model = _session_model_cache[session_id]
    provider = _providers[model]

    config = get_recognition_config(institution_id)
    quality_threshold = config["quality_threshold"]
    # NOT VALIDATED: InsightFace/ArcFace uses cosine similarity (1.0 - best_dist)
    # whereas Dlib uses Euclidean distance.
    # Placeholder threshold value must be reviewed and tuned in a future task.
    match_threshold = 0.5 if model == "insightface" else config["match_threshold"]
    low_confidence_threshold = 0.6 if model == "insightface" else config["low_confidence_threshold"]

    student_ids, candidate_embeddings = fetch_candidate_embeddings(institution_id, session_id, model=model)

    faces = provider.detect(frame)
    if not faces:
        log_observation(institution_id, session_id, None, captured_at, None, provider.frame_quality(frame), "no_face",
                         evidence_photo_url=frame_path)
        return {"faces_detected": 0, "results": []}

    results = []
    for face in faces:
        quality = provider.quality(frame, face)

        if quality < quality_threshold:
            log_observation(institution_id, session_id, None, captured_at, None, quality, "poor_quality",
                             evidence_photo_url=frame_path)
            results.append({"match_status": "poor_quality", "quality": quality})
            continue

        embedding = provider.embed(frame, face)
        best = find_best_match(provider, embedding, candidate_embeddings)

        if best is None:
            log_observation(institution_id, session_id, None, captured_at, None, quality, "unknown_face",
                             evidence_photo_url=frame_path)
            results.append({"match_status": "unknown_face"})
            continue

        matched_student_id = student_ids[best.student_index]
        if best.distance <= match_threshold:
            status = "matched"
        elif best.distance <= low_confidence_threshold:
            status = "low_confidence"
        else:
            status = "unknown_face"
            matched_student_id = None

        log_observation(institution_id, session_id, matched_student_id, captured_at,
                         best.similarity, quality, status, evidence_photo_url=frame_path)
        results.append({"match_status": status, "student_id": matched_student_id,
                         "similarity": best.similarity})

    return {"faces_detected": len(faces), "results": results}
