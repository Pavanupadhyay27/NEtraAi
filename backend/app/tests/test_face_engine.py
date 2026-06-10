import pytest
import numpy as np
from app.services.face_engine import FaceEngine

def test_face_engine_initialization():
    # Verify that engine initializes and can enter mock mode if files are missing
    engine = FaceEngine()
    assert hasattr(engine, 'mock_mode')

def test_face_engine_mock_mode_detection():
    engine = FaceEngine()
    engine.mock_mode = True
    
    # Create blank dummy image
    dummy_image = np.zeros((480, 640, 3), dtype=np.uint8)
    
    faces = engine.detect_faces(dummy_image)
    assert len(faces) == 1
    assert "bbox" in faces[0]
    assert "confidence" in faces[0]
    assert "landmarks" in faces[0]
    assert len(faces[0]["landmarks"]) == 5

def test_face_engine_mock_mode_embedding():
    engine = FaceEngine()
    engine.mock_mode = True
    
    dummy_face = np.zeros((112, 112, 3), dtype=np.uint8)
    embedding = engine.extract_embedding(dummy_face)
    
    assert embedding.shape == (512,)
    # Verify it is L2 normalized
    norm = np.linalg.norm(embedding)
    assert pytest.approx(norm, abs=1e-5) == 1.0

def test_face_engine_liveness():
    engine = FaceEngine()
    engine.mock_mode = True
    
    dummy_image = np.zeros((480, 640, 3), dtype=np.uint8)
    score, is_live = engine.check_liveness(dummy_image, [100, 100, 200, 200])
    
    assert score >= 0.0 and score <= 1.0
    assert isinstance(is_live, bool)

def test_cosine_similarity():
    engine = FaceEngine()
    
    v1 = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    v2 = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    v3 = np.array([0.0, 1.0, 0.0], dtype=np.float32)
    
    assert pytest.approx(engine.cosine_similarity(v1, v2)) == 1.0
    assert pytest.approx(engine.cosine_similarity(v1, v3)) == 0.0
