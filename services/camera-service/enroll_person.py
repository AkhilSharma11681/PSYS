import sys
from PIL import Image
import numpy as np
from app.recognition.provider import DlibFaceRecognitionProvider
from app.db.client import get_client

INSTITUTION_ID = "485a5846-54c5-48bf-a523-6f86ecb54c42"

photo_path = sys.argv[1]
full_name = sys.argv[2]

provider = DlibFaceRecognitionProvider()
img = Image.open(photo_path).convert("RGB")
frame = np.array(img)
faces = provider.detect(frame)
if len(faces) != 1:
    print(f"ERROR: expected 1 face, found {len(faces)}")
    sys.exit(1)

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

print(f"{full_name}: student_id = {student_id}")
