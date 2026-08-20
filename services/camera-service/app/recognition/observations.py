from app.db.client import get_client

def log_observation(institution_id, session_id, student_id, captured_at,
                     similarity_score, quality_score, match_status,
                     model_version="dlib_resnet_v1", evidence_photo_url=None):
    client = get_client()
    client.table("attendance_observations").insert({
        "institution_id": institution_id,
        "session_id": session_id,
        "student_id": student_id,
        "captured_at": captured_at,
        "similarity_score": similarity_score,
        "quality_score": quality_score,
        "match_status": match_status,
        "model_version": model_version,
        "evidence_photo_url": evidence_photo_url,
    }).execute()
