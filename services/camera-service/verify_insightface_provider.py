import cv2
import numpy as np
import os
from app.recognition.provider import DlibFaceRecognitionProvider, find_best_match
from app.recognition.insightface_provider import InsightFaceRecognitionProvider

def main():
    print("=" * 70)
    print("1. Testing InsightFaceRecognitionProvider on Test Images")
    print("=" * 70)

    insight_provider = InsightFaceRecognitionProvider()
    test_dir = "/Users/anshtomar/Desktop/PSYS/test-images"
    test_images = [
        "WhatsApp Image 2026-09-09 at 21.57.42.jpeg",
        "WhatsApp Image 2026-09-09 at 21.57.43.jpeg"
    ]

    insight_embs = []

    for img_name in test_images:
        path = os.path.join(test_dir, img_name)
        print(f"\n--- [InsightFace] Processing: {img_name} ---")
        frame = cv2.imread(path)
        if frame is None:
            print(f"Error: could not load {path}")
            continue

        calls_before = insight_provider.get_call_count
        faces = insight_provider.detect(frame)
        print(f"Faces detected: {len(faces)}")

        for i, face in enumerate(faces):
            quality = insight_provider.quality(frame, face)
            embedding = insight_provider.embed(frame, face)
            insight_embs.append(embedding)
            print(f"  Face #{i+1}: box=(top={face.top}, right={face.right}, bottom={face.bottom}, left={face.left}) | quality={quality:.4f} | emb_len={len(embedding)} | emb_norm={np.linalg.norm(embedding):.2f}")

        calls_after = insight_provider.get_call_count
        print(f"App.get() call count for this image (detect + {len(faces)} embeds): {calls_after - calls_before} (Expected: 1)")

    # Test InsightFace with find_best_match
    print("\n--- [InsightFace] Testing find_best_match (Provider-Agnostic) ---")
    if len(insight_embs) >= 2:
        best_match_self = find_best_match(insight_provider, insight_embs[0], [insight_embs[0], insight_embs[1]])
        print(f"Self-match: index={best_match_self.student_index}, distance={best_match_self.distance:.4f}, similarity={best_match_self.similarity:.4f}")

        best_match_other = find_best_match(insight_provider, insight_embs[0], [insight_embs[1]])
        print(f"Different face match: index={best_match_other.student_index}, distance={best_match_other.distance:.4f}, similarity={best_match_other.similarity:.4f}")

    print("\n" + "=" * 70)
    print("2. Testing DlibFaceRecognitionProvider with Unified find_best_match")
    print("=" * 70)

    dlib_provider = DlibFaceRecognitionProvider()
    dlib_embs = []

    for img_name in test_images:
        path = os.path.join(test_dir, img_name)
        print(f"\n--- [Dlib] Processing: {img_name} ---")
        frame = cv2.imread(path)
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        faces = dlib_provider.detect(rgb_frame)
        print(f"Faces detected: {len(faces)}")

        for i, face in enumerate(faces):
            quality = dlib_provider.quality(rgb_frame, face)
            embedding = dlib_provider.embed(rgb_frame, face)
            dlib_embs.append(embedding)
            print(f"  Face #{i+1}: box=(top={face.top}, right={face.right}, bottom={face.bottom}, left={face.left}) | quality={quality:.4f} | emb_len={len(embedding)}")

    # Test Dlib with find_best_match
    print("\n--- [Dlib] Testing find_best_match (Provider-Agnostic) ---")
    if len(dlib_embs) >= 2:
        best_match_self_dlib = find_best_match(dlib_provider, dlib_embs[0], [dlib_embs[0], dlib_embs[1]])
        print(f"Self-match: index={best_match_self_dlib.student_index}, distance={best_match_self_dlib.distance:.4f}, similarity={best_match_self_dlib.similarity:.4f}")

        best_match_other_dlib = find_best_match(dlib_provider, dlib_embs[0], [dlib_embs[1]])
        print(f"Different face match: index={best_match_other_dlib.student_index}, distance={best_match_other_dlib.distance:.4f}, similarity={best_match_other_dlib.similarity:.4f}")

if __name__ == "__main__":
    main()
