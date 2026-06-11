FROM python:3.12-slim

# Install system dependencies for OpenCV and pyttsx3/espeak
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    espeak \
    alsa-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# Copy and install python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ .

# Download ONNX model weights during container build
RUN python app/core/download_models.py

# Create directories and set full permissions so non-root users (like Hugging Face UID 1000) can read/write
RUN mkdir -p /workspace/uploads /workspace/models && chmod -R 777 /workspace

# Expose FastAPI port
EXPOSE 8000

# Run FastAPI app with dynamic port fallback
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
