from datetime import datetime, timezone, timedelta
from app.db.client import get_client
from app.finalization.boundaries import detect_session_boundaries

client = get_client()

INSTITUTION_ID = "485a5846-54c5-48bf-a523-6f86ecb54c42"
SESSION_ID = "b8a2512c-ed44-4116-8dbf-6b557e123592"
CLASS_ID = "44444444-4444-4444-4444-444444444444"

# Test-only override: with a 1-student roster, min_quorum_count must be 1
# for quorum to ever be mathematically reachable. Production default stays 3.
_existing_config = client.table("attendance_config").select("id").eq("institution_id", INSTITUTION_ID).execute()
if _existing_config.data:
    client.table("attendance_config").update({
        "min_quorum_count": 1, "quorum_fraction": 0.3, "is_active": True,
    }).eq("institution_id", INSTITUTION_ID).execute()
else:
    client.table("attendance_config").insert({
        "institution_id": INSTITUTION_ID, "min_quorum_count": 1, "quorum_fraction": 0.3, "is_active": True,
    }).execute()

client.table("classes").upsert({
    "id": CLASS_ID, "institution_id": INSTITUTION_ID,
    "room_id": client.table("rooms").select("id").limit(1).execute().data[0]["id"],
    "subject": "Quorum Test",
}).execute()
client.table("class_sessions").update({"class_id": CLASS_ID}).eq("id", SESSION_ID).execute()
client.table("class_enrollments").upsert({
    "institution_id": INSTITUTION_ID, "class_id": CLASS_ID,
    "student_id": "c8efd6a6-e899-4686-a537-6f252efaf9d2", "status": "active",
}, on_conflict="class_id,student_id").execute()

# clean up any leftover observations from a previous crashed run
client.table("attendance_observations").delete().eq("session_id", SESSION_ID).execute()

base = datetime.now(timezone.utc)
for i in range(3):
    client.table("attendance_observations").insert({
        "institution_id": INSTITUTION_ID, "session_id": SESSION_ID,
        "student_id": "c8efd6a6-e899-4686-a537-6f252efaf9d2",
        "captured_at": (base + timedelta(minutes=i * 5)).isoformat(),
        "similarity_score": 0.99, "quality_score": 1.0, "match_status": "matched",
        "model_version": "dlib_resnet_v1",
    }).execute()

result = detect_session_boundaries(SESSION_ID)
print("Case 1 (3 rounds, threshold=1):", result)
assert result["quorum_reached"] is True, "Expected quorum to be reached"
print("  PASS")

client.table("attendance_observations").delete().eq("session_id", SESSION_ID).execute()

result2 = detect_session_boundaries(SESSION_ID)
print("Case 2 (no observations):", result2)
assert result2["quorum_reached"] is False
assert result2["processing_status"] == "needs_review"
print("  PASS")

# revert the test-only config override
client.table("attendance_config").delete().eq("institution_id", INSTITUTION_ID).execute()

print("\nAll quorum tests passed")
