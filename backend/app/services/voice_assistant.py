import os
import tempfile
import threading
import logging
import wave
import struct
import math

logger = logging.getLogger("VoiceAssistant")

# We use pyttsx3 for offline TTS
try:
    import pyttsx3
except ImportError:
    pyttsx3 = None

class VoiceAssistant:
    def __init__(self):
        self.engine_available = False
        self.lock = threading.Lock()
        
        if pyttsx3 is not None:
            # We initialize pyttsx3 inside a lock to prevent multi-threading issues.
            try:
                # Test initialization
                engine = pyttsx3.init()
                # Set voice properties
                engine.setProperty('rate', 150)  # Speed percent
                engine.setProperty('volume', 0.9)  # Volume 0-1
                self.engine_available = True
                logger.info("pyttsx3 Voice Assistant initialized successfully.")
            except Exception as e:
                logger.warning(f"Failed to initialize pyttsx3 (common on headless servers): {e}. Using pure-python WAV fallback.")

    def generate_speech_file(self, text: str) -> str:
        """
        Synthesizes speech to a WAV file and returns the path.
        If pyttsx3 is not available, generates a fallback WAV file with audio.
        """
        temp_dir = tempfile.gettempdir()
        file_path = os.path.join(temp_dir, f"speech_{hash(text)}.wav")
        
        # If file already exists, return it
        if os.path.exists(file_path):
            return file_path
            
        if self.engine_available:
            with self.lock:
                try:
                    # Initialize locally in the thread to avoid COM apartment errors on Windows
                    engine = pyttsx3.init()
                    engine.setProperty('rate', 155)
                    engine.setProperty('volume', 0.9)
                    
                    # Try to select a female voice if available
                    voices = engine.getProperty('voices')
                    for voice in voices:
                        if "female" in voice.name.lower() or "zira" in voice.name.lower():
                            engine.setProperty('voice', voice.id)
                            break
                            
                    engine.save_to_file(text, file_path)
                    engine.runAndWait()
                    
                    # Verify file was written
                    if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
                        return file_path
                except Exception as e:
                    logger.error(f"pyttsx3 synthesis failed: {e}. Falling back to WAV generator.")

        # Bulletproof Fallback: Generate a simple double-beep/tone WAV file using pure Python
        # so the application never fails or hangs.
        self._generate_fallback_wav(file_path)
        return file_path

    def _generate_fallback_wav(self, file_path: str):
        """
        Generates a 0.5s double-tone beep in a pure python wave file.
        This provides a reliable offline alternative if espeak/SAPI5 is missing.
        """
        sample_rate = 8000
        duration = 0.4  # seconds
        num_samples = int(duration * sample_rate)
        
        # 440 Hz (A4 note) tone
        freq = 440.0
        
        try:
            with wave.open(file_path, 'wb') as wav_file:
                wav_file.setnchannels(1)  # Mono
                wav_file.setsampwidth(2)  # 16-bit
                wav_file.setframerate(sample_rate)
                
                for i in range(num_samples):
                    # Introduce a small gap in the middle to make it sound like a double-beep
                    if num_samples // 3 < i < (num_samples // 3 + num_samples // 10):
                        val = 0
                    else:
                        t = float(i) / sample_rate
                        # Sine wave
                        val = int(32767.0 * 0.5 * math.sin(2.0 * math.pi * freq * t))
                    
                    data = struct.pack('<h', val)
                    wav_file.writeframesraw(data)
        except Exception as e:
            logger.error(f"Failed to generate fallback wav file: {e}")
            # Write a completely blank file as a last resort
            with open(file_path, 'wb') as f:
                f.write(b'')
