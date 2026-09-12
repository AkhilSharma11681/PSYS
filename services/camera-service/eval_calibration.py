import os
import sys
import numpy as np
import cv2
import csv
from PIL import Image

# Add to path
sys.path.insert(0, "/Users/anshtomar/Desktop/PSYS/services/camera-service")

from app.recognition.insightface_provider import InsightFaceRecognitionProvider
from app.recognition.provider import FaceBox, find_best_match

# 1. Setup
provider = InsightFaceRecognitionProvider()
test_images_dir = "/Users/anshtomar/Desktop/PSYS/test-images"
results_csv = "/Users/anshtomar/Desktop/PSYS/services/camera-service/eval_results.csv"

# 2. Iterate and group images
subjects = {}
for filename in os.listdir(test_images_dir):
    if filename in [".DS_Store", "__pycache__"] or not filename.lower().endswith(('.jpeg', '.jpg', '.png')):
        continue

    # Subject grouping: filename prefix
    name_part = os.path.splitext(filename)[0]
    subject = name_part.split('_')[0]

    if subject not in subjects:
        subjects[subject] = []
    subjects[subject].append(os.path.join(test_images_dir, filename))

# 3. Process images and compute embeddings
subject_embeddings = [] # List of (subject, embedding)

print(f"Processing {len(subjects)} subjects...")
for subject, file_paths in subjects.items():
    for file_path in file_paths:
        try:
            img = Image.open(file_path).convert("RGB")
            frame = np.array(img)

            # InsightFace expects BGR in detect, which provider handles RGB->BGR internally if needed
            faces = provider.detect(frame)
            if not faces:
                print(f"  [Skipping] No face in {file_path}")
                continue

            # Use biggest face
            face_box = sorted(faces, key=lambda f: (f.right - f.left)*(f.bottom - f.top), reverse=True)[0]

            embedding = provider.embed(frame, face_box)
            subject_embeddings.append({"subject": subject, "embedding": np.array(embedding)})
            print(f"  [Processed] {subject}: {os.path.basename(file_path)}")

        except Exception as e:
            print(f"  [Error] Processing {file_path}: {e}")

# 4. Pairwise comparisons
comparisons = []
match_threshold = 0.5

genuine_comparisons = [] # (matched)
imposter_comparisons = [] # (matched)

print("\nComputing pairwise comparisons...")
for i in range(len(subject_embeddings)):
    for j in range(i + 1, len(subject_embeddings)):
        s1 = subject_embeddings[i]
        s2 = subject_embeddings[j]

        # Use production find_best_match logic (which calls provider.match)
        best = find_best_match(provider, s1["embedding"], [s2["embedding"]])
        sim = best.similarity
        dist = best.distance

        is_match = (s1["subject"] == s2["subject"])
        matched = (dist <= match_threshold)

        comparison = {
            "subject1": s1["subject"],
            "subject2": s2["subject"],
            "is_match": is_match,
            "dist": dist,
            "sim": sim,
            "matched": matched
        }
        comparisons.append(comparison)

        if is_match:
            genuine_comparisons.append(matched)
        else:
            imposter_comparisons.append(matched)

# 5. Output results
total_genuine = len(genuine_comparisons)
false_rejects = genuine_comparisons.count(False)
frr = false_rejects / total_genuine if total_genuine > 0 else 0

total_imposter = len(imposter_comparisons)
false_accepts = imposter_comparisons.count(True)
far = false_accepts / total_imposter if total_imposter > 0 else 0

print(f"\nResults (Threshold dist={match_threshold}):")
print(f"  Genuine: {total_genuine}, False Reject Rate: {frr:.4f}")
print(f"  Imposter: {total_imposter}, False Accept Rate: {far:.4f}")

# Write to CSV
with open(results_csv, 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=["subject1", "subject2", "is_match", "dist", "sim", "matched"])
    writer.writeheader()
    writer.writerows(comparisons)

print(f"\nWritten results to {results_csv}")
