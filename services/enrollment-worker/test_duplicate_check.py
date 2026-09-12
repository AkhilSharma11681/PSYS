import os
import sys

# Ensure dummy env vars exist if not present so importing worker does not fail
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "dummy-key")

# Add services/enrollment-worker to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.worker import is_duplicate_face


def run_tests():
    print("==================================================================")
    print("Running isolated unit tests for cross-student duplicate face check")
    print("==================================================================")

    # Base embedding (128-dimensional vector of zeros)
    dim = 128
    base_embedding = [0.0] * dim

    # Close embedding: distance = 0.25 (below default threshold 0.40)
    close_embedding = [0.25] + [0.0] * (dim - 1)

    # Far embedding: distance = 0.75 (above default threshold 0.40)
    far_embedding = [0.75] + [0.0] * (dim - 1)

    threshold = 0.40

    tests_passed = 0
    total_tests = 5

    # Test 1: Distance below threshold -> duplicate flagged
    other_biometrics = [
        {"student_id": "student-A", "face_embedding": close_embedding}
    ]
    is_dup, collided_id, dist = is_duplicate_face(base_embedding, other_biometrics, threshold)
    assert is_dup is True, "Expected duplicate to be True for close embedding"
    assert collided_id == "student-A", f"Expected collided_id to be 'student-A', got {collided_id}"
    assert abs(dist - 0.25) < 1e-6, f"Expected distance 0.25, got {dist}"
    print(f"✓ Case 1 passed: Distance below threshold ({dist:.4f} <= {threshold}) -> flagged as duplicate (collided with {collided_id})")
    tests_passed += 1

    # Test 2: Distance above threshold -> not duplicate
    other_biometrics = [
        {"student_id": "student-B", "face_embedding": far_embedding}
    ]
    is_dup, collided_id, dist = is_duplicate_face(base_embedding, other_biometrics, threshold)
    assert is_dup is False, "Expected duplicate to be False for far embedding"
    assert collided_id is None, f"Expected collided_id to be None, got {collided_id}"
    assert dist is None, f"Expected dist to be None, got {dist}"
    print(f"✓ Case 2 passed: Distance above threshold (0.7500 > {threshold}) -> not flagged as duplicate")
    tests_passed += 1

    # Test 3: Empty other_embeddings list -> not duplicate
    other_biometrics = []
    is_dup, collided_id, dist = is_duplicate_face(base_embedding, other_biometrics, threshold)
    assert is_dup is False, "Expected duplicate to be False for empty list"
    assert collided_id is None, f"Expected collided_id to be None, got {collided_id}"
    assert dist is None, f"Expected dist to be None, got {dist}"
    print(f"✓ Case 3 passed: Empty candidate list -> never flagged as duplicate")
    tests_passed += 1

    # Test 4: Multiple candidates (one far, one close) -> correctly flags the collision
    other_biometrics = [
        {"student_id": "student-far", "face_embedding": far_embedding},
        {"student_id": "student-close", "face_embedding": close_embedding},
    ]
    is_dup, collided_id, dist = is_duplicate_face(base_embedding, other_biometrics, threshold)
    assert is_dup is True, "Expected duplicate to be True when one candidate collides"
    assert collided_id == "student-close", f"Expected collided_id to be 'student-close', got {collided_id}"
    assert abs(dist - 0.25) < 1e-6, f"Expected distance 0.25, got {dist}"
    print(f"✓ Case 4 passed: Multi-candidate list (1 far, 1 close) -> successfully detected collision with {collided_id} at distance {dist:.4f}")
    tests_passed += 1

    # Test 5: String-serialized embedding (PostgREST pgvector string representation)
    string_embedding_repr = str(close_embedding)
    other_biometrics = [
        {"student_id": "student-str", "face_embedding": string_embedding_repr}
    ]
    is_dup, collided_id, dist = is_duplicate_face(base_embedding, other_biometrics, threshold)
    assert is_dup is True, "Expected duplicate to be True for string-parsed embedding"
    assert collided_id == "student-str", f"Expected collided_id to be 'student-str', got {collided_id}"
    assert abs(dist - 0.25) < 1e-6, f"Expected distance 0.25, got {dist}"
    print(f"✓ Case 5 passed: String-serialized vector parsed and verified -> flagged as duplicate (collided with {collided_id})")
    tests_passed += 1

    # Test 6: Mismatched embedding dimensions are skipped gracefully
    total_tests = 7
    mismatched_embedding = [0.0] * 512  # different length
    other_biometrics = [
        {"student_id": "student-mismatch", "face_embedding": mismatched_embedding}
    ]
    is_dup, collided_id, dist = is_duplicate_face(base_embedding, other_biometrics, threshold)
    assert is_dup is False, "Expected mismatched length to be skipped and not flagged as duplicate"
    assert collided_id is None
    assert dist is None
    print(f"✓ Case 6 passed: Mismatched dimensions (128 vs 512) skipped gracefully without raising errors")
    tests_passed += 1

    # Test 7: Matches a student's demoted (non-primary) photo even when primary is different
    # Simulates student-multi having primary (far) and demoted (close) embeddings in DB
    other_biometrics = [
        {"student_id": "student-multi", "face_embedding": far_embedding},  # e.g. current primary
        {"student_id": "student-multi", "face_embedding": close_embedding}, # e.g. demoted historical
    ]
    is_dup, collided_id, dist = is_duplicate_face(base_embedding, other_biometrics, threshold)
    assert is_dup is True, "Expected duplicate to be True when matching a demoted non-primary embedding"
    assert collided_id == "student-multi", f"Expected collided_id to be 'student-multi', got {collided_id}"
    assert abs(dist - 0.25) < 1e-6, f"Expected distance 0.25, got {dist}"
    print(f"✓ Case 7 passed: Collision with demoted (non-primary) embedding of a student detected (collided with {collided_id} at distance {dist:.4f})")
    tests_passed += 1

    print("==================================================================")
    print(f"All {tests_passed}/{total_tests} tests passed successfully!")
    print("==================================================================")


if __name__ == "__main__":
    run_tests()
