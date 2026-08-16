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
    """Thin interface — swap the dlib implementation later without touching
    attendance logic, DB schema, or the dashboard (spec Section 6)."""

    def detect(self, frame) -> list[FaceBox]: ...
    def quality(self, face_box: FaceBox) -> float: ...
    def embed(self, frame, face_box: FaceBox) -> list[float]: ...
    def match(self, embedding, candidate_embeddings, threshold: float = 0.6) -> MatchResult: ...


class DlibFaceRecognitionProvider(FaceRecognitionProvider):
    def detect(self, frame) -> list[FaceBox]:
        locations = face_recognition.face_locations(frame)
        return [FaceBox(top=t, right=r, bottom=b, left=l) for (t, r, b, l) in locations]

    def quality(self, face_box: FaceBox) -> float:
        width = face_box.right - face_box.left
        height = face_box.bottom - face_box.top
        return min(1.0, (width * height) / (150 * 150))

    def embed(self, frame, face_box: FaceBox) -> list[float]:
        location = (face_box.top, face_box.right, face_box.bottom, face_box.left)
        encodings = face_recognition.face_encodings(frame, known_face_locations=[location])
        if not encodings:
            raise ValueError("could not generate embedding for face")
        return encodings[0].tolist()

    def match(self, embedding, candidate_embeddings, threshold: float = 0.6) -> MatchResult:
        if not candidate_embeddings:
            return MatchResult(matched=False, student_index=None, similarity_score=0.0)

        distances = face_recognition.face_distance(candidate_embeddings, np.array(embedding))
        best_index = int(np.argmin(distances))
        best_distance = float(distances[best_index])
        similarity = 1 - best_distance

        if best_distance <= threshold:
            return MatchResult(matched=True, student_index=best_index, similarity_score=similarity)
        return MatchResult(matched=False, student_index=None, similarity_score=similarity)
