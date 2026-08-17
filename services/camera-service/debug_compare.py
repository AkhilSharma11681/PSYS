from PIL import Image
import numpy as np
import face_recognition
from app.recognition.provider import DlibFaceRecognitionProvider

provider = DlibFaceRecognitionProvider()

def get_embedding(path):
    img = Image.open(path).convert("RGB")
    frame = np.array(img)
    faces = provider.detect(frame)
    return np.array(provider.embed(frame, faces[0])), provider.quality(frame, faces[0])

e1, q1 = get_embedding("test_face.jpg")
e2, q2 = get_embedding("test_face_2.jpg")

distance = face_recognition.face_distance([e1], e2)[0]
print(f"Exact distance: {distance}")
print(f"Quality — photo 1: {q1:.3f}, photo 2: {q2:.3f}")
