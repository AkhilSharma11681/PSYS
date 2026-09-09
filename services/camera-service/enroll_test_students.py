import sys
sys.path.insert(0, "/Users/akhilsharma/Documents/PSYS/services/camera-service")
from PIL import Image
import numpy as np
from app.recognition.provider import DlibFaceRecognitionProvider
from app.db.client import get_client

INSTITUTION_ID = "485a5846-54c5-48bf-a523-6f86ecb54c42"
CLASS_ID = "55555555-5555-5555-5555-555555555555"
STUDENT_MAPPINGS = [
    ("person_a.jpg", "c72e127c-85fe-43b5-9c75-991fce4bef93"), # Test Student One
    ("person_b.jpg", "a3c74e20-bfa9-45a5-b92a-eb5589a2ffdd"), # Test Student Two
    ("person_c.jpg", "9a6d6612-7c34-4a1e-a816-aa2347eaf8b3"), # Test Student Three
]

provider = DlibFaceRecognitionProvider()
client = get_client()

for photo_name, student_id in STUDENT_MAPPINGS:
    full_path = f"/Users/akhilsharma/Documents/PSYS/services/camera-service/{photo_name}"
    print(f"Processing {photo_name} for student {student_id}...")
    
    img = Image.open(full_path).convert("RGB")
    frame = np.array(img)
    faces = provider.detect(frame)
    if len(faces) != 1:
        print(f"  ERROR: expected 1 face, found {len(faces)}")
        continue
        
    embedding = provider.embed(frame, faces[0])
    quality_score = provider.quality(frame, faces[0])
    
    # Check if biometric already exists
    client.table("student_biometrics").delete().eq("student_id", student_id).execute()
    
    client.table("student_biometrics").insert({
        "institution_id": INSTITUTION_ID,
        "student_id": student_id,
        "face_embedding": embedding,
        "embedding_model": "dlib_resnet_v1",
        "is_primary": True,
        "quality_score": quality_score,
        "embedding_version": 1
    }).execute()
    print(f"  Inserted biometrics")
    
    # Check class enrollment
    enrollment = client.table("class_enrollments").select("*").eq("class_id", CLASS_ID).eq("student_id", student_id).execute()
    if not enrollment.data:
        client.table("class_enrollments").insert({
            "institution_id": INSTITUTION_ID,
            "class_id": CLASS_ID,
            "student_id": student_id,
            "status": "active"
        }).execute()
        print(f"  Enrolled in test class {CLASS_ID}")
    else:
        # make sure it's active
        client.table("class_enrollments").update({"status": "active"}).eq("class_id", CLASS_ID).eq("student_id", student_id).execute()
        print(f"  Already enrolled, updated to active")

print("Done enrolling test students.")
