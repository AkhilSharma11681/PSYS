from PIL import Image
import numpy as np
from app.recognition.provider import DlibFaceRecognitionProvider
from app.db.client import get_client

INSTITUTION_ID = "485a5846-54c5-48bf-a523-6f86ecb54c42"

provider = DlibFaceRecognitionProvider()
img = Image.open("test_face.jpg").convert("RGB")
frame = np.array(img)
faces = provider.detect(frame)
embedding = provider.embed(frame, faces[0])

client = get_client()

student = client.table("students").insert({
    "institution_id": INSTITUTION_ID,
    "status": "active",
}).execute()
student_id = student.data[0]["id"]

client.table("student_biometrics").insert({
    "institution_id": INSTITUTION_ID,
    "student_id": student_id,
    "face_embedding": embedding,
    "embedding_model": "dlib_resnet_v1",
}).execute()

print(f"✅ Enrolled test student: {student_id}")
