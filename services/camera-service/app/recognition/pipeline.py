from datetime import datetime, timezone
from app.recognition.provider import DlibFaceRecognitionProvider, find_best_match
from app.recognition.matching import fetch_candidate_embeddings
from app.recognition.observations import log_observation
from app.recognition.config import get_recognition_config

provider = DlibFaceRecognitionProvider()


def process_frame(frame, institution_id: str, session_id: str):
    config = get_recognition_config(institution_id)
    quality_threshold = config["quality_threshold"]
    match_threshold = config["match_threshold"]              # confident match
    low_confidence_threshold = config["low_confidence_threshold"]  # borderline, needs review

    captured_at = datetime.now(timezone.utc).isoformat()
    student_ids, candidate_embeddings = fetch_candidate_embeddings(institution_id)

    faces = provider.detect(frame)
    if not faces:
        log_observation(institution_id, session_id, None, captured_at,
                         None, None, "no_face")
        return {"faces_detected": 0, "results": []}

    results = []
    for face in faces:
        quality = provider.quality(frame, face)

        if quality < quality_threshold:
            log_observation(institution_id, session_id, None, captured_at,
                             None, quality, "poor_quality")
            results.append({"match_status": "poor_quality", "quality": quality})
            continue

        embedding = provider.embed(frame, face)
        best = find_best_match(provider, embedding, candidate_embeddings)

        if best is None:
            log_observation(institution_id, session_id, None, captured_at,
                             None, quality, "unknown_face")
            results.append({"match_status": "unknown_face"})
            continue

        matched_student_id = student_ids[best.student_index]

        if best.distance <= match_threshold:
            status = "matched"
        elif best.distance <= low_confidence_threshold:
            status = "low_confidence"  # surfaced to a human, not guessed
        else:
            status = "unknown_face"
            matched_student_id = None  # too far to even suggest a guess

        log_observation(institution_id, session_id, matched_student_id, captured_at,
                         best.similarity, quality, status)
        results.append({"match_status": status, "student_id": matched_student_id,
                         "similarity": best.similarity})

    return {"faces_detected": len(faces), "results": results}
