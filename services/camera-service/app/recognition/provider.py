from dataclasses import dataclass
import numpy as np
import face_recognition


@dataclass
class FaceBox:
    top: int
    right: int
    bottom: int
    left: int


@dataclass
class MatchResult:
    matched: bool
    student_index: int | None
    similarity_score: float


class FaceRecognitionProvider:
    def detect(self, frame) -> list[FaceBox]: ...
    def quality(self, frame, face_box: FaceBox) -> float: ...
    def embed(self, frame, face_box: FaceBox) -> list[float]: ...
    def match(self, embedding, candidate_embeddings, threshold: float = 0.4) -> MatchResult: ...


class DlibFaceRecognitionProvider(FaceRecognitionProvider):
    def detect(self, frame) -> list[FaceBox]:
        locations = face_recognition.face_locations(frame)
        return [FaceBox(top=t, right=r, bottom=b, left=l) for (t, r, b, l) in locations]

    def quality(self, frame, face_box: FaceBox) -> float:
        """Combines three checks into one conservative score: face size,
        blur (sharpness), and lighting. Uses min() rather than an average
        so a face that fails badly on any single dimension (e.g. sharp
        but pitch-black, or big but blurry) can't be masked by scoring
        well on the others."""
        import cv2

        top, right, bottom, left = face_box.top, face_box.right, face_box.bottom, face_box.left
        crop = frame[max(0, top):bottom, max(0, left):right]
        if crop.size == 0:
            return 0.0

        width = right - left
        height = bottom - top
        size_score = min(1.0, (width * height) / (150 * 150))

        gray = cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY)

        # Blur: variance of the Laplacian. Sharp edges produce high
        # variance; blur smooths edges out and collapses it toward 0.
        # 100 is an empirical "acceptably sharp" floor from webcam
        # testing, not a theoretical constant — revisit if false
        # poor_quality rejections show up in production logs.
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        blur_score = min(1.0, laplacian_var / 100.0)

        # Lighting: mean brightness should sit in a usable mid-range.
        # Underexposed or blown-out crops both degrade embedding
        # quality even when the face is sharp and well-sized.
        mean_brightness = float(np.mean(gray))
        if mean_brightness < 40:
            brightness_score = mean_brightness / 40.0
        elif mean_brightness > 220:
            brightness_score = max(0.0, (255 - mean_brightness) / 35.0)
        else:
            brightness_score = 1.0

        return max(0.0, min(size_score, blur_score, brightness_score))

    def embed(self, frame, face_box: FaceBox) -> list[float]:
        location = (face_box.top, face_box.right, face_box.bottom, face_box.left)
        encodings = face_recognition.face_encodings(frame, known_face_locations=[location])
        if not encodings:
            raise ValueError("could not generate embedding for face")
        return encodings[0].tolist()

    def match(self, embedding, candidate_embeddings, threshold: float = 0.4) -> MatchResult:
        if not candidate_embeddings:
            return MatchResult(matched=False, student_index=None, similarity_score=0.0)

        distances = face_recognition.face_distance(candidate_embeddings, np.array(embedding))
        best_index = int(np.argmin(distances))
        best_distance = float(distances[best_index])
        similarity = 1 - best_distance

        if best_distance <= threshold:
            return MatchResult(matched=True, student_index=best_index, similarity_score=similarity)
        return MatchResult(matched=False, student_index=None, similarity_score=similarity)


class BestMatch:
    def __init__(self, student_index, distance, similarity):
        self.student_index = student_index
        self.distance = distance
        self.similarity = similarity


def find_best_match(provider, embedding, candidate_embeddings):
    """Returns raw distance/similarity without applying any threshold —
    the caller decides matched/low_confidence/unknown based on its own
    config (spec: thresholds live in attendance_config, not hardcoded)."""
    import face_recognition
    import numpy as np

    if not candidate_embeddings:
        return None

    distances = face_recognition.face_distance(candidate_embeddings, np.array(embedding))
    best_index = int(np.argmin(distances))
    best_distance = float(distances[best_index])
    return BestMatch(best_index, best_distance, 1 - best_distance)
