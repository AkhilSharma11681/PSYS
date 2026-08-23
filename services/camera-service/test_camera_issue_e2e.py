from datetime import datetime, timezone, timedelta
from app.db.client import get_client
from app.finalization.orchestrator import finalize_session

client = get_client()
INSTITUTION_ID = "485a5846-54c5-48bf-a523-6f86ecb54c42"
SESSION_ID = "b8a2512c-ed44-4116-8dbf-6b557e123592"
CLASS_ID = "44444444-4444-4444-4444-444444444444"
STUDENT_A = "c8efd6a6-e899-4686-a537-6f252efaf9d2"
CAMERA_ID = "fa955acb-1b5b-4330-83c1-e10f3fa11810"

client.table("class_sessions").update({"class_id": None}).eq("id", SESSION_ID).execute()
client.table("class_enrollments").delete().eq("class_id", CLASS_ID).execute()
client.table("classes").delete().eq("id", CLASS_ID).execute()
client.table("classes").insert({
    "id": CLASS_ID, "institution_id": INSTITUTION_ID,
    "room_id": client.table("rooms").select("id").limit(1).execute().data[0]["id"],
    "subject": "Camera Issue E2E",
}).execute()
client.table("class_sessions").update({
    "class_id": CLASS_ID, "finalized_at": None, "actual_start": None, "actual_end": None,
}).eq("id", SESSION_ID).execute()
client.table("class_enrollments").insert({
    "institution_id": INSTITUTION_ID, "class_id": CLASS_ID, "student_id": STUDENT_A, "status": "active",
}).execute()

existing = client.table("attendance_config").select("id").eq("institution_id", INSTITUTION_ID).execute()
config_payload = {"min_quorum_count": 1, "quorum_fraction": 0.3, "min_valid_observations": 2, "is_active": True}
if existing.data:
    client.table("attendance_config").update(config_payload).eq("institution_id", INSTITUTION_ID).execute()
else:
    client.table("attendance_config").insert({"institution_id": INSTITUTION_ID, **config_payload}).execute()

client.table("attendance_observations").delete().eq("session_id", SESSION_ID).execute()
client.table("capture_events").delete().eq("session_id", SESSION_ID).execute()

base = datetime.now(timezone.utc)
# Matched observations bracket the window: quorum detection will set
# actual_start=0min, actual_end=25min based on these two.
for m in [0, 25]:
    client.table("attendance_observations").insert({
        "institution_id": INSTITUTION_ID, "session_id": SESSION_ID, "student_id": STUDENT_A,
        "captured_at": (base + timedelta(minutes=m)).isoformat(),
        "similarity_score": 0.9, "quality_score": 1.0, "match_status": "matched",
        "model_version": "dlib_resnet_v1",
    }).execute()
# Camera failures INSIDE that window (10-20min) -- this is the actual gap
# gap_check.py will walk between the two matched points.
for m in [10, 15, 20]:
    client.table("capture_events").insert({
        "institution_id": INSTITUTION_ID, "session_id": SESSION_ID, "camera_id": CAMERA_ID,
        "attempted_at": (base + timedelta(minutes=m)).isoformat(),
        "succeeded": False, "error": "could_not_open_stream", "frame_stored": False,
    }).execute()

result = finalize_session(SESSION_ID)
print("Finalize result:", result)

row = client.table("final_attendance").select("*").eq("session_id", SESSION_ID).eq("student_id", STUDENT_A).execute()
print("final_attendance row:", row.data)
assert row.data[0]["status"] == "camera_issue", f"expected camera_issue, got {row.data}"
print("PASS: camera_issue persisted end-to-end")
