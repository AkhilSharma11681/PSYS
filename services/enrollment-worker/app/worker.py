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

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def process_job(job):
    job_id = job["id"]
    student_id = job["student_id"]
    institution_id = job["institution_id"]
    storage_path = job["storage_path"]

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

        existing = (
            supabase.table("student_biometrics")
            .select("id")
            .eq("student_id", student_id)
            .eq("is_primary", True)
            .execute()
        )
        is_primary = len(existing.data) == 0

        supabase.table("student_biometrics").insert(
            {
                "institution_id": institution_id,
                "student_id": student_id,
                "face_embedding": result["embedding"],
                "embedding_model": result["embedding_model"],
                "embedding_version": 1,
                "is_primary": is_primary,
                "quality_score": result["quality_score"],
            }
        ).execute()

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

        # Mark done BEFORE deleting the photo -- if the delete step below
        # fails, the embedding is already safely stored and the job is
        # correctly marked complete; we just log a cleanup warning rather
        # than treating storage deletion as part of the critical path.
        supabase.table("enrollment_jobs").update(
            {
                "status": "done",
                "processed_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", job_id).execute()

        print(f"[done] job {job_id} -> student {student_id}")

        # Spec Section 9 (Privacy & Biometric Data Lifecycle): once the
        # embedding is generated, the raw enrollment photo should not be
        # kept long-term -- only the embedding vector persists.
        try:
            supabase.storage.from_("enrollment-photos").remove([storage_path])
            print(f"[cleanup] deleted source photo for job {job_id}")
        except Exception as cleanup_error:
            print(f"[cleanup warning] job {job_id} photo not deleted: {cleanup_error}")

    except Exception as e:
        supabase.table("enrollment_jobs").update(
            {"status": "failed", "error": str(e)}
        ).eq("id", job_id).execute()
        print(f"[failed] job {job_id}: {e}")


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
