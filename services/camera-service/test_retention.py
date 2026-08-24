from datetime import datetime, timezone, timedelta
from app.db.client import get_client
from app.privacy.retention import cleanup_expired_evidence_photos

client = get_client()
INSTITUTION_ID = "485a5846-54c5-48bf-a523-6f86ecb54c42"
SESSION_ID = "b8a2512c-ed44-4116-8dbf-6b557e123592"
CAMERA_ID = "fa955acb-1b5b-4330-83c1-e10f3fa11810"

client.table("attendance_observations").delete().eq("session_id", SESSION_ID).execute()
client.table("capture_events").delete().eq("session_id", SESSION_ID).execute()

# Upload a real test object to storage so the delete path is genuinely exercised
test_path = f"{INSTITUTION_ID}/{SESSION_ID}/retention_test.jpg"
with open("test_face.jpg", "rb") as f:
    client.storage.from_("capture-frames").upload(test_path, f.read(), {"upsert": "true"})
print(f"Uploaded test object: {test_path}")

# Session finalized well past the 48h default window
old_time = (datetime.now(timezone.utc) - timedelta(hours=72)).isoformat()
client.table("class_sessions").update({"finalized_at": old_time}).eq("id", SESSION_ID).execute()

base = datetime.now(timezone.utc)
obs = client.table("attendance_observations").insert({
    "institution_id": INSTITUTION_ID, "session_id": SESSION_ID,
    "student_id": "c8efd6a6-e899-4686-a537-6f252efaf9d2",
    "captured_at": base.isoformat(), "similarity_score": 0.9, "quality_score": 1.0,
    "match_status": "matched", "model_version": "dlib_resnet_v1",
    "evidence_photo_url": test_path,
}).execute()
event = client.table("capture_events").insert({
    "institution_id": INSTITUTION_ID, "session_id": SESSION_ID, "camera_id": CAMERA_ID,
    "attempted_at": base.isoformat(), "succeeded": True, "frame_path": test_path, "frame_stored": True,
}).execute()

result = cleanup_expired_evidence_photos(INSTITUTION_ID)
print("Cleanup result:", result)
assert result["photos_deleted"] >= 1, f"expected at least 1 photo deleted, got {result}"
assert result["errors"] == 0, f"expected no errors, got {result}"

obs_after = client.table("attendance_observations").select("evidence_photo_url").eq("id", obs.data[0]["id"]).execute()
event_after = client.table("capture_events").select("frame_path, frame_stored").eq("id", event.data[0]["id"]).execute()
print("attendance_observations after:", obs_after.data)
print("capture_events after:", event_after.data)
assert obs_after.data[0]["evidence_photo_url"] is None, "expected evidence_photo_url nulled"
assert event_after.data[0]["frame_path"] is None, "expected frame_path nulled"
assert event_after.data[0]["frame_stored"] is False, "expected frame_stored=False"

storage_check = client.storage.from_("capture-frames").list(f"{INSTITUTION_ID}/{SESSION_ID}")
remaining = [f["name"] for f in storage_check]
print("Remaining files in storage folder:", remaining)
assert "retention_test.jpg" not in remaining, "expected file actually deleted from storage"

print("\nPASS: retention cleanup verified end-to-end")
