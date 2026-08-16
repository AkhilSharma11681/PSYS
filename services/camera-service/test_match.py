from PIL import Image
import numpy as np
from app.recognition.provider import DlibFaceRecognitionProvider

def get_embedding(provider, image_path):
    img = Image.open(image_path).convert("RGB")
    frame = np.array(img)
    faces = provider.detect(frame)
    if not faces:
        return None
    return provider.embed(frame, faces[0])

if __name__ == "__main__":
    provider = DlibFaceRecognitionProvider()
    THRESHOLD = 0.4  # tighter than the 0.6 library default — fewer false positives

    reference_embedding = get_embedding(provider, "test_face.jpg")
    print(f"Reference embedding generated: {reference_embedding is not None}")

    same_face_embedding = get_embedding(provider, "test_face.jpg")
    result = provider.match(same_face_embedding, [reference_embedding], threshold=THRESHOLD)
    print(f"\nTest 1 (person A vs person A):")
    print(f"  matched={result.matched}, similarity={result.similarity_score:.3f}")
    assert result.matched, "❌ Same face should match!"
    print("  ✅ PASS")

    different_face_embedding = get_embedding(provider, "test_face_2.jpg")
    result = provider.match(different_face_embedding, [reference_embedding], threshold=THRESHOLD)
    print(f"\nTest 2 (person B vs person A's reference):")
    print(f"  matched={result.matched}, similarity={result.similarity_score:.3f}")
    assert not result.matched, "❌ Different faces should NOT match!"
    print("  ✅ PASS")

    print("\n🎉 All match tests passed")
