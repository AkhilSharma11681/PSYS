import os
import sys
from unittest.mock import MagicMock, patch

# Ensure dummy env vars exist if not present so importing worker does not fail
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "dummy-key")

# Add services/enrollment-worker to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import app.worker as worker
from app.worker import is_duplicate_face, fetch_other_biometrics


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
    total_tests = 9

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

    # Test 8: Multi-page pagination across 3 batches (1000 + 1000 + 250 = 2250 rows)
    ranges_called_multi = []

    def mock_range_multi(start, end):
        ranges_called_multi.append((start, end))
        builder = MagicMock()
        if start == 0:
            data = [{"student_id": f"student-{i}", "face_embedding": [0.0] * 128} for i in range(1000)]
        elif start == 1000:
            data = [{"student_id": f"student-{i}", "face_embedding": [0.0] * 128} for i in range(1000, 2000)]
        elif start == 2000:
            data = [{"student_id": f"student-{i}", "face_embedding": [0.0] * 128} for i in range(2000, 2250)]
        else:
            data = []

        exec_res = MagicMock()
        exec_res.data = data
        builder.execute.return_value = exec_res
        return builder

    mock_builder_multi = MagicMock()
    mock_builder_multi.select.return_value = mock_builder_multi
    mock_builder_multi.eq.return_value = mock_builder_multi
    mock_builder_multi.neq.return_value = mock_builder_multi
    mock_builder_multi.range.side_effect = mock_range_multi

    mock_supabase_multi = MagicMock()
    mock_supabase_multi.table.return_value = mock_builder_multi

    with patch.object(worker, "supabase", mock_supabase_multi):
        rows_multi = fetch_other_biometrics("inst-123", "target-student", batch_size=1000)

    assert len(rows_multi) == 2250, f"Expected 2250 rows, got {len(rows_multi)}"
    assert len(ranges_called_multi) == 3, f"Expected 3 range calls, got {len(ranges_called_multi)}"
    assert ranges_called_multi == [(0, 999), (1000, 1999), (2000, 2999)], f"Unexpected range calls: {ranges_called_multi}"
    print(f"✓ Case 8 passed: Multi-page pagination fetched 2250 rows across 3 calls with expected ranges {ranges_called_multi}")
    tests_passed += 1

    # Test 9: Single-page edge case with fewer than batch_size rows (5 rows -> 1 call)
    ranges_called_single = []

    def mock_range_single(start, end):
        ranges_called_single.append((start, end))
        builder = MagicMock()
        data = [{"student_id": f"student-single-{i}", "face_embedding": [0.0] * 128} for i in range(5)]
        exec_res = MagicMock()
        exec_res.data = data
        builder.execute.return_value = exec_res
        return builder

    mock_builder_single = MagicMock()
    mock_builder_single.select.return_value = mock_builder_single
    mock_builder_single.eq.return_value = mock_builder_single
    mock_builder_single.neq.return_value = mock_builder_single
    mock_builder_single.range.side_effect = mock_range_single

    mock_supabase_single = MagicMock()
    mock_supabase_single.table.return_value = mock_builder_single

    with patch.object(worker, "supabase", mock_supabase_single):
        rows_single = fetch_other_biometrics("inst-123", "target-student", batch_size=1000)

    assert len(rows_single) == 5, f"Expected 5 rows, got {len(rows_single)}"
    assert len(ranges_called_single) == 1, f"Expected 1 range call, got {len(ranges_called_single)}"
    assert ranges_called_single == [(0, 999)], f"Unexpected range calls: {ranges_called_single}"
    print(f"✓ Case 9 passed: Single-page fetch returned 5 rows in exactly 1 call with range {ranges_called_single}")
    tests_passed += 1

    print("==================================================================")
    print(f"All {tests_passed}/{total_tests} tests passed successfully!")
    print("==================================================================")


if __name__ == "__main__":
    run_tests()
