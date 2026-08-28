"""Standalone diagnostic: breaks down quality() into its three
sub-components (size/blur/brightness) for a given image file, so a low
score can be traced to its actual cause instead of guessed at.
Usage: python diagnose_quality.py path/to/photo.jpg
"""
import sys
import cv2
import numpy as np
from PIL import Image
from app.recognition.provider import DlibFaceRecognitionProvider

path = sys.argv[1]
img = Image.open(path).convert("RGB")
frame = np.array(img)

provider = DlibFaceRecognitionProvider()
faces = provider.detect(frame)

if not faces:
    print("No face detected at all.")
    sys.exit(1)

face = faces[0]
top, right, bottom, left = face.top, face.right, face.bottom, face.left
crop = frame[max(0, top):bottom, max(0, left):right]

width = right - left
height = bottom - top
size_score = min(1.0, (width * height) / (150 * 150))

gray = cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY)
laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
blur_score = min(1.0, laplacian_var / 100.0)

mean_brightness = float(np.mean(gray))
if mean_brightness < 40:
    brightness_score = mean_brightness / 40.0
elif mean_brightness > 220:
    brightness_score = max(0.0, (255 - mean_brightness) / 35.0)
else:
    brightness_score = 1.0

final = max(0.0, min(size_score, blur_score, brightness_score))

print(f"Image size: {img.size}")
print(f"Face box: {width}x{height} px")
print(f"--- Sub-scores ---")
print(f"size_score:       {size_score:.3f}  (face crop {width}x{height} vs 150x150 target)")
print(f"blur_score:       {blur_score:.3f}  (laplacian variance = {laplacian_var:.1f}, target >= 100)")
print(f"brightness_score: {brightness_score:.3f}  (mean brightness = {mean_brightness:.1f}, ideal 40-220)")
print(f"--- Final (min of above) ---")
print(f"quality: {final:.3f}")
