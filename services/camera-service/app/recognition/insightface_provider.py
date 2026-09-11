import cv2
import numpy as np
import insightface
from insightface.app import FaceAnalysis
from app.recognition.provider import FaceRecognitionProvider, FaceBox, MatchResult

class InsightFaceRecognitionProvider(FaceRecognitionProvider):
    def __init__(self):
        # providers=['CPUExecutionProvider'] as validated in Task 2
        self.app = FaceAnalysis(name="buffalo_l", providers=['CPUExecutionProvider'])
        self.app.prepare(ctx_id=-1, det_size=(640, 640))
        self._last_detected_faces = []
        self.get_call_count = 0

    def detect(self, frame) -> list[FaceBox]:
        # Calling detect() always computes fresh results and stores them
        # as an instance attribute, making them available for subsequent embed() calls
        # Convert RGB frame to BGR for InsightFace FaceAnalysis (which expects BGR arrays)
        bgr_frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR) if frame.ndim == 3 and frame.shape[2] == 3 else frame
        self._last_detected_faces = self.app.get(bgr_frame)
        self.get_call_count += 1

        # BBox format is [left, top, right, bottom]
        return [
            FaceBox(
                top=int(f.bbox[1]),
                right=int(f.bbox[2]),
                bottom=int(f.bbox[3]),
                left=int(f.bbox[0])
            ) for f in self._last_detected_faces
        ]

    def _get_face_by_box(self, face_box: FaceBox):
        best_f = None
        max_iou = 0.0

        # Match face from last detect() call with highest IOU
        for f in self._last_detected_faces:
            inter_left = max(f.bbox[0], face_box.left)
            inter_top = max(f.bbox[1], face_box.top)
            inter_right = min(f.bbox[2], face_box.right)
            inter_bottom = min(f.bbox[3], face_box.bottom)

            if inter_right < inter_left or inter_bottom < inter_top:
                continue

            intersection = (inter_right - inter_left) * (inter_bottom - inter_top)
            area1 = (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1])
            area2 = (face_box.right - face_box.left) * (face_box.bottom - face_box.top)
            union = area1 + area2 - intersection

            iou = intersection / union
            if iou > max_iou:
                max_iou = iou
                best_f = f

        return best_f

    def quality(self, frame, face_box: FaceBox) -> float:
        top, right, bottom, left = face_box.top, face_box.right, face_box.bottom, face_box.left
        crop = frame[max(0, top):bottom, max(0, left):right]
        if crop.size == 0:
            return 0.0

        width = right - left
        height = bottom - top
        size_score = min(1.0, (width * height) / (150 * 150))

        crop_150 = cv2.resize(crop, (150, 150))
        gray = cv2.cvtColor(crop_150, cv2.COLOR_RGB2GRAY)
        gray_blurred = cv2.GaussianBlur(gray, (3, 3), 0)

        laplacian_var = cv2.Laplacian(gray_blurred, cv2.CV_64F).var()
        blur_score = min(1.0, laplacian_var / 100.0)

        mean_brightness = float(np.mean(gray))
        if mean_brightness < 40:
            brightness_score = mean_brightness / 40.0
        elif mean_brightness > 220:
            brightness_score = max(0.0, (255 - mean_brightness) / 35.0)
        else:
            brightness_score = 1.0

        return max(0.0, min(size_score, blur_score, brightness_score))

    def frame_quality(self, frame) -> float:
        if frame.size == 0:
            return 0.0

        gray = cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        blur_score = min(1.0, laplacian_var / 100.0)

        mean_brightness = float(np.mean(gray))
        if mean_brightness < 40:
            brightness_score = mean_brightness / 40.0
        elif mean_brightness > 220:
            brightness_score = max(0.0, (255 - mean_brightness) / 35.0)
        else:
            brightness_score = 1.0

        return max(0.0, min(blur_score, brightness_score))

    def embed(self, frame, face_box: FaceBox) -> list[float]:
        face = self._get_face_by_box(face_box)
        if face is None:
            raise ValueError("could not generate embedding for face; ensure detect() was called on this frame first")
        return face.embedding.tolist()

    def match(self, embedding, candidate_embeddings, threshold: float = 0.4) -> MatchResult:
        if not candidate_embeddings:
            return MatchResult(matched=False, student_index=None, similarity_score=0.0)

        # Cosine similarity for InsightFace (ArcFace)
        # Dist = 1 - CosSim
        # Threshold in config is for distance (e.g. 0.4)

        emb = np.array(embedding)
        cand_embs = np.array(candidate_embeddings)

        norms = np.linalg.norm(cand_embs, axis=1) * np.linalg.norm(emb)
        sims = np.dot(cand_embs, emb) / norms

        # Best match is max similarity, min distance
        best_index = int(np.argmax(sims))
        best_sim = float(sims[best_index])
        best_dist = 1.0 - best_sim

        if best_dist <= threshold:
            return MatchResult(matched=True, student_index=best_index, similarity_score=best_sim)
        return MatchResult(matched=False, student_index=None, similarity_score=best_sim)
