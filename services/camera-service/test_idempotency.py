from app.recognition.pipeline import process_frame
from PIL import Image
import numpy as np

img = Image.open('test_face.jpg').convert('RGB')
frame = np.array(img)
fixed_time = '2026-01-01T00:00:00+00:00'

result1 = process_frame(frame, '485a5846-54c5-48bf-a523-6f86ecb54c42', 'b8a2512c-ed44-4116-8dbf-6b557e123592', frame_path=None, captured_at=fixed_time)
print('First call:', result1)

result2 = process_frame(frame, '485a5846-54c5-48bf-a523-6f86ecb54c42', 'b8a2512c-ed44-4116-8dbf-6b557e123592', frame_path=None, captured_at=fixed_time)
print('Second call (retry simulation):', result2)
