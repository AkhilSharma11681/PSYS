import ast
import math
import os
import time
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
CAMERA_SERVICE_URL = os.environ.get("CAMERA_SERVICE_URL", "http://localhost:8000")
POLL_INTERVAL_SECONDS = 5
MAX_RETRIES = 3

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

_config_cache = {}


def _parse_embedding(raw):
    """Supabase returns pgvector columns either as native lists or as strings
    like '[0.1,0.2,...]'. Normalize both cases."""
    if isinstance(raw, str):
        return ast.literal_eval(raw)
    return raw


def get_match_threshold(institution_id: str) -> float:
    """Fetch match_threshold from institution-specific attendance_config if active,
    otherwise fallback to platform default (institution_id is null). Cached per-process."""
    if institution_id in _config_cache:
        return _config_cache[institution_id]

    result = (
        supabase.table("attendance_config")
        .select("match_threshold")
        .eq("institution_id", institution_id)
        .eq("is_active", True)
        .execute()
    )

    if not result.data:
        result = (
            supabase.table("attendance_config")
            .select("match_threshold")
            .is_("institution_id", "null")
            .eq("is_active", True)
            .execute()
        )

    if not result.data:
        raise RuntimeError("no attendance_config found — not even a platform default")

    threshold = float(result.data[0]["match_threshold"])
    _config_cache[institution_id] = threshold
    return threshold


def is_duplicate_face(
    new_embedding: list[float],
    other_biometrics: list[dict],
    threshold: float,
) -> tuple[bool, str | None, float | None]:
    """Check if new_embedding is within threshold Euclidean distance of any
    embedding in other_biometrics.

    other_biometrics is a list of dicts with 'student_id' and 'face_embedding'.
    Returns (is_duplicate, collided_student_id, distance).
    """
    for row in other_biometrics:
        existing_embedding = _parse_embedding(row.get("face_embedding"))
        if existing_embedding is None:
            continue
        if len(new_embedding) != len(existing_embedding):
            print(
                f"[duplicate check warning] skipped student {row.get('student_id')}: "
                f"embedding dimension mismatch ({len(new_embedding)} vs {len(existing_embedding)})"
            )
            continue
        dist = math.dist(new_embedding, existing_embedding)
        if dist <= threshold:
            return True, row.get("student_id"), dist
    return False, None, None


def process_job(job):
    job_id = job["id"]
    student_id = job["student_id"]
    institution_id = job["institution_id"]
    storage_path = job["storage_path"]
    retry_count = job.get("retry_count", 0)

    supabase.table("enrollment_jobs").update({"status": "processing"}).eq("id", job_id).execute()

    try:
        file_bytes = supabase.storage.from_("enrollment-photos").download(storage_path)

        response = requests.post(
            f"{CAMERA_SERVICE_URL}/internal/embed",
            files={"file": ("photo.jpg", file_bytes, "image/jpeg")},
            timeout=30,
        )

        if response.status_code != 200:
            raise ValueError(f"embed failed ({response.status_code}): {response.text}")

        result = response.json()
        new_embedding = result["embedding"]
        new_quality = result["quality_score"]

        # Cross-student duplicate check: compare new embedding against all embeddings of other students in the same institution
        match_threshold = get_match_threshold(institution_id)
        other_biometrics = (
            supabase.table("student_biometrics")
            .select("student_id, face_embedding")
            .eq("institution_id", institution_id)
            .neq("student_id", student_id)
            .execute()
        )

        is_dup, collided_student_id, dist = is_duplicate_face(
            new_embedding,
            other_biometrics.data or [],
            match_threshold,
        )
        if is_dup:
            error_msg = (
                "Photo appears to match an existing student's face "
                "(possible duplicate enrollment). Manual review required."
            )
            supabase.table("enrollment_jobs").update(
                {
                    "status": "failed",
                    "error": error_msg,
                }
            ).eq("id", job_id).execute()
            print(
                f"[duplicate face detected] job {job_id} -> student {student_id} "
                f"collided with student {collided_student_id} (distance {dist:.4f} <= {match_threshold})"
            )
            return

        # ASSUMPTION: Single worker process only. No atomic job claiming exists, so concurrent workers would race here.
        existing = (
            supabase.table("student_biometrics")
            .select("id, quality_score")
            .eq("student_id", student_id)
            .eq("is_primary", True)
            .execute()
        )

        is_primary = False
        old_primary_id = None

        if len(existing.data) == 0:
            is_primary = True
        else:
            current_primary = existing.data[0]
            if new_quality > (current_primary.get("quality_score") or 0.0):
                is_primary = True
                old_primary_id = current_primary["id"]

        supabase.table("student_biometrics").insert(
            {
                "institution_id": institution_id,
                "student_id": student_id,
                "face_embedding": new_embedding,
                "embedding_model": result["embedding_model"],
                "embedding_version": 1,
                "is_primary": is_primary,
                "quality_score": new_quality,
            }
        ).execute()
        
        if old_primary_id:
            supabase.table("student_biometrics").update(
                {"is_primary": False}
            ).eq("id", old_primary_id).execute()

        student = (
            supabase.table("students")
            .select("enrollment_photo_count")
            .eq("id", student_id)
            .single()
            .execute()
        )
        current_count = student.data["enrollment_photo_count"] or 0
        supabase.table("students").update(
            {"enrollment_photo_count": current_count + 1}
        ).eq("id", student_id).execute()

        supabase.table("enrollment_jobs").update(
            {
                "status": "done",
                "processed_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", job_id).execute()

        print(f"[done] job {job_id} -> student {student_id}")

        try:
            supabase.storage.from_("enrollment-photos").remove([storage_path])
            print(f"[cleanup] deleted source photo for job {job_id}")
        except Exception as cleanup_error:
            print(f"[cleanup warning] job {job_id} photo not deleted: {cleanup_error}")

    except Exception as e:
        new_retry_count = retry_count + 1
        if new_retry_count <= MAX_RETRIES:
            # Transient failures (camera-service temporarily down, network
            # blip) shouldn't need a manual DB fix -- put it back in the
            # queue, next poll cycle picks it up again.
            supabase.table("enrollment_jobs").update(
                {"status": "pending", "retry_count": new_retry_count, "error": str(e)}
            ).eq("id", job_id).execute()
            print(f"[retry {new_retry_count}/{MAX_RETRIES}] job {job_id}: {e}")
        else:
            supabase.table("enrollment_jobs").update(
                {"status": "failed", "error": str(e)}
            ).eq("id", job_id).execute()
            print(f"[failed after {MAX_RETRIES} retries] job {job_id}: {e}")


def poll_loop():
    print(f"enrollment-worker started, polling every {POLL_INTERVAL_SECONDS}s...")
    while True:
        try:
            result = (
                supabase.table("enrollment_jobs")
                .select("*")
                .eq("status", "pending")
                .order("created_at")
                .limit(5)
                .execute()
            )
            jobs = result.data
            if jobs:
                print(f"found {len(jobs)} pending job(s)")
            for job in jobs:
                process_job(job)
        except Exception as e:
            print(f"[poll error] {e}")

        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    poll_loop()
