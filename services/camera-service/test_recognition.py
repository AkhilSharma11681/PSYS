from PIL import Image
import numpy as np
from app.recognition.provider import DlibFaceRecognitionProvider

if __name__ == "__main__":
    # Load via PIL and force-convert to RGB — handles PNGs with alpha
    # channels, CMYK JPEGs, or other formats face_recognition can't read directly.
    img = Image.open("test_face.jpg").convert("RGB")
    frame = np.array(img)

    provider = DlibFaceRecognitionProvider()

    faces = provider.detect(frame)
    print(f"Detected {len(faces)} face(s)")

    if faces:
        face = faces[0]
        q = provider.quality(frame, face)
        print(f"Quality score: {q:.2f}")

        embedding = provider.embed(frame, face)
        print(f"Embedding length: {len(embedding)}")
