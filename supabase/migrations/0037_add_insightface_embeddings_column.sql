-- Migration 0037: Add nullable insightface_embedding_v2 column
-- Stores 512-D ArcFace/InsightFace vectors, separate from existing 128-D dlib column.

alter table student_biometrics
  add column if not exists face_embedding_v2 vector(512);

-- Matching index style of existing face_embedding: ivfflat with cosine distance ops
create index if not exists student_biometrics_face_embedding_v2_idx
  on student_biometrics using ivfflat (face_embedding_v2 vector_cosine_ops);
