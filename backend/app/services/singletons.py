from app.services.face_engine import FaceEngine
from app.services.voice_assistant import VoiceAssistant

# Singletons to prevent reloading ONNX models on every request
face_engine = FaceEngine()
voice_assistant = VoiceAssistant()
