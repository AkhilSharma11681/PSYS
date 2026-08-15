from datetime import datetime, timezone
from app.recognition.provider import DlibFaceRecognitionProvider
from app.recognition.matching import fetch_candidate_embeddings
from app.recognition.observations import log_observation

provider = DlibFaceRecognitionProvider()
QUALITY_THRESHOLD = 0.3
MATCH_THRESHOLD = 0.4


def process_frame(frame, institution_id: str, session_id: str):
    captured_at = datetime.now(timezone.utc).isoformat()
    student_ids, candidate_embeddings = fetch_candidate_embeddings(institution_id)

    faces = provider.detect(frame)
    if not faces:
        log_observation(institution_id, session_id, None, captured_at,
                         None, None, "no_face")
        return {"faces_detected": 0, "results": []}

    results = []
    for face in faces:
        quality = provider.quality(face)

        if quality < QUALITY_THRESHOLD:
            log_observation(institution_id, session_id, None, captured_at,
                             None, quality, "poor_quality")
            results.append({"match_status": "poor_quality", "quality": quality})
            continue

        embedding = provider.embed(frame, face)
        match = provider.match(embedding, candidate_embeddings, threshold=MATCH_THRESHOLD)

        if match.matched:
            matched_student_id = student_ids[match.student_index]
            log_observation(institution_id, session_id, matched_student_id, captured_at,
                             match.similarity_score, quality, "matched")
            results.append({"match_status": "matched", "student_id": matched_student_id,
                             "similarity": match.similarity_score})
        else:
            log_observation(institution_id, session_id, None, captured_at,
                             match.similarity_score, quality, "unknown_face")
            results.append({"match_status": "unknown_face", "similarity": match.similarity_score})

    return {"faces_detected": len(faces), "results": results}
