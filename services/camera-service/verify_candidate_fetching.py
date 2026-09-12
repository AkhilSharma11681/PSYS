import os
import numpy as np
from app.db.client import get_client
from app.recognition.matching import fetch_candidate_embeddings

def main():
    # 1. Setup
    client = get_client()

    # Find a valid institution_id (from attendance_config or students table)
    # Testing with 'Test University' (institution id: 70881552-0663-494b-8b95-59cfdd5fb246)
    # or the admin institution (485a5846-54c5-48bf-a523-6f86ecb54c42)
    institution_id = "70881552-0663-494b-8b95-59cfdd5fb246"

    # Pick any active student for the dummy embedding
    active_students = client.table("students").select("id").eq("institution_id", institution_id).execute()
    if not active_students.data:
        print("No active students found to test with.")
        return

    student_id = active_students.data[0]["id"]
    print(f"Testing with student_id: {student_id}")

    # 2. Insert dummy biometric
    dummy_embedding = [0.01] * 512
    insert_result = client.table("student_biometrics").insert({
        "institution_id": institution_id,
        "student_id": student_id,
        "face_embedding_v2": dummy_embedding,
        "embedding_model": "insightface_arcface",
        "embedding_version": 2,
        "quality_score": 1.0,
        "is_primary": False
    }).execute()

    dummy_record_id = insert_result.data[0]["id"]
    print(f"Inserted dummy biometric with id: {dummy_record_id}")

    try:
        # A session_id that includes this student (assuming roster includes active students)
        # We need a session_id. Let's find one.
        sessions = client.table("class_sessions").select("id").limit(1).execute()
        if not sessions.data:
            print("No sessions found to test candidate fetching.")
            return
        session_id = sessions.data[0]["id"]

        # 3. Test InsightFace fetch
        print(f"\n--- Testing InsightFace fetch ---")
        ids, embeddings = fetch_candidate_embeddings(institution_id, session_id, model='insightface')

        print(f"Fetched {len(ids)} candidates.")

        # Validate student is returned
        if student_id not in ids:
            print("FAILED: Test student not in InsightFace candidate list.")
        else:
            student_idx = ids.index(student_id)
            if len(embeddings[student_idx]) == 512:
                print("PASSED: InsightFace embedding length correct (512).")
            else:
                print(f"FAILED: InsightFace embedding length incorrect. Expected 512, got {len(embeddings[student_idx])}")

        # 4. Test Dlib fetch
        print(f"\n--- Testing Dlib fetch ---")
        ids_dlib, embeddings_dlib = fetch_candidate_embeddings(institution_id, session_id, model='dlib')

        print(f"Fetched {len(ids_dlib)} dlib candidates.")
        found_512 = False
        for emb in embeddings_dlib:
            if len(emb) == 512:
                found_512 = True
                break
        if found_512:
            print("FAILED: Dlib fetch returned 512-D embedding.")
        else:
            print("PASSED: Dlib fetch did not return 512-D embeddings.")

    finally:
        # 5. Cleanup
        print(f"\n--- Cleaning up dummy biometric ---")
        client.table("student_biometrics").delete().eq("id", dummy_record_id).execute()
        print("Cleanup done.")

if __name__ == "__main__":
    main()
