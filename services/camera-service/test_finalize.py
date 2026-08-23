from datetime import datetime, timezone, timedelta
from app.db.client import get_client
from app.finalization.orchestrator import finalize_session

client = get_client()
INSTITUTION_ID = "485a5846-54c5-48bf-a523-6f86ecb54c42"
SESSION_ID = "b8a2512c-ed44-4116-8dbf-6b557e123592"
CLASS_ID = "44444444-4444-4444-4444-444444444444"
STUDENT_A = "c8efd6a6-e899-4686-a537-6f252efaf9d2"

# --- reset session to a clean, unfinalized state ---
client.table("attendance_observations").delete().eq("session_id", SESSION_ID).execute()
client.table("class_enrollments").delete().eq("class_id", CLASS_ID).execute()
client.table("classes").delete().eq("id", CLASS_ID).execute()

room = client.table("rooms").select("id").limit(1).execute().data[0]["id"]
client.table("classes").insert({
    "id": CLASS_ID, "institution_id": INSTITUTION_ID, "room_id": room, "subject": "Finalize Test",
}).execute()
client.table("class_sessions").update({
    "class_id": CLASS_ID, "finalized_at": None, "actual_start": None, "actual_end": None,
}).eq("id", SESSION_ID).execute()
client.table("class_enrollments").insert({
    "institution_id": INSTITUTION_ID, "class_id": CLASS_ID, "student_id": STUDENT_A, "status": "active",
}).execute()
_existing_config = client.table("attendance_config").select("id").eq("institution_id", INSTITUTION_ID).execute()
if _existing_config.data:
    client.table("attendance_config").update({
        "min_quorum_count": 1, "quorum_fraction": 0.3, "is_active": True,
    }).eq("institution_id", INSTITUTION_ID).execute()
else:
    client.table("attendance_config").insert({
        "institution_id": INSTITUTION_ID, "min_quorum_count": 1, "quorum_fraction": 0.3, "is_active": True,
    }).execute()

base = datetime.now(timezone.utc)
for m in [0, 5, 10]:
    client.table("attendance_observations").insert({
        "institution_id": INSTITUTION_ID, "session_id": SESSION_ID, "student_id": STUDENT_A,
        "captured_at": (base + timedelta(minutes=m)).isoformat(),
        "similarity_score": 0.9, "quality_score": 1.0, "match_status": "matched",
        "model_version": "dlib_resnet_v1",
    }).execute()

# --- first call: should actually finalize ---
result1 = finalize_session(SESSION_ID)
print("First call:", result1)
assert result1["status"] == "finalized", f"expected finalized, got {result1}"
print("  PASS")

# --- second call (retry simulation): should short-circuit ---
result2 = finalize_session(SESSION_ID)
print("Second call (retry):", result2)
assert result2["status"] == "already_finalized", f"expected already_finalized, got {result2}"
print("  PASS")

print("\nAll finalize orchestrator tests passed")
