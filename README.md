---
title: NetraID Backend
emoji: 🧑‍💼
colorFrom: blue
colorTo: blue
sdk: docker
app_port: 8000
pinned: false
---

# NetraID - Production-Grade AI Face Authentication Attendance System

NetraID is an enterprise-grade, 100% free, and self-hosted face-authentication attendance platform. Using advanced facial biometrics, liveness classifiers, and high-performance vector indexes, it provides an offline, secure, and production-ready system suitable for digital kiosks, schools, colleges, and startups.

---

## Technical Stack & Architecture

NetraID uses clean-architecture layers (Repository and Service layers) to structure code modularly.

- **AI & Computer Vision**: SCRFD (Face Detection), ArcFace (Face Recognition), MiniFASNet (Silent Face Anti-Spoofing) running on pure ONNX Runtime.
- **Backend API**: Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic V2, JWT RBAC, and Audit Logging.
- **Voice synthesis**: Offline `pyttsx3` text-to-speech engine.
- **Vector Database**: PostgreSQL 16 with the native `pgvector` extension.
- **Frontend Kiosk & Dashboard**: Next.js 15, TypeScript, Tailwind CSS, Framer Motion, and Apache ECharts.
- **Deployment**: Docker, Docker Compose, and Nginx.

---

## Project Structure

```text
NetraID/
├── backend/
│   ├── app/
│   │   ├── api/             # API Router endpoints
│   │   ├── core/            # Database connection, security, seeding
│   │   ├── crud/            # CRUD repositories (SQLAlchemy 2.0)
│   │   ├── models/          # Database ORM models
│   │   ├── schemas/         # Pydantic V2 validation schemas
│   │   └── services/        # FaceEngine AI & pyttsx3 TTS helper
│   ├── requirements.txt     # Python requirements
│   └── Dockerfile           # Backend image builder
├── frontend/
│   ├── app/                 # Next.js pages (Login, Dashboard, Kiosk)
│   ├── components/          # Shared components (SidebarLayout)
│   ├── package.json         # Node requirements
│   └── Dockerfile           # Frontend image builder
├── docker/
│   └── nginx.conf           # Reverse proxy configuration
├── docker-compose.yml       # Docker orchestrator
└── README.md                # System documentation
```

---

## Setup Instructions

NetraID runs natively on both **Windows** and **Linux**.

### Option A: Quick Launch via Docker Compose (Recommended)

1. **Clone & Navigate**:
   ```bash
   cd NetraID
   ```

2. **Download AI Model Weights**:
   Run the model downloader script locally to pull the ONNX models to the `./models` folder, or let the backend do it on boot. To run it manually:
   ```bash
   cd backend
   python -m pip install -r requirements.txt
   python app/core/download_models.py
   cd ..
   ```

3. **Start Stack**:
   ```bash
   docker compose up --build
   ```

4. **Access Applications**:
   - **Dashboard & Kiosk**: [http://localhost](http://localhost) (Nginx proxy)
   - **FastAPI API Swagger Docs**: [http://localhost/docs](http://localhost/docs)
   - **PostgreSQL Database**: Port `5432`

---

### Option B: Local Development Setup (Windows & Linux)

#### 1. Setup PostgreSQL + pgvector
Make sure you have a running PostgreSQL instance and install the `pgvector` extension:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

#### 2. Run Backend
1. **Initialize Virtual Env**:
   ```bash
   cd backend
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On Linux:
   source venv/bin/activate
   ```
2. **Install Packages**:
   - *On Linux*: Install `espeak` for pyttsx3 and Mesa GL for OpenCV:
     ```bash
     sudo apt-get install -y libgl1-mesa-glx libglib2.0-0 espeak
     ```
   - *On Windows*: Python packages will install SAPI5 dependencies automatically.
   ```bash
   pip install -r requirements.txt
   ```
3. **Download ONNX Models**:
   ```bash
   python app/core/download_models.py
   ```
4. **Boot Server**:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

#### 3. Run Frontend
1. **Navigate & Install**:
   ```bash
   cd ../frontend
   npm install
   ```
2. **Boot Dev Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## System Workflows

### 1. Seeding & Credentials
On startup, the system seeds default values.
- **Initial Super Admin**: `admin@netraid.ai` / `Admin@NetraID2026`
- **Default Shift Timing**: Start: `09:00`, End: `17:00`
- **Grace Period**: 15 minutes.
- **Similarity Thresholds**: Face Cosine distance: `0.60`, Liveness threshold: `0.75`

### 2. Biometric Face Enrollment (10 Poses)
To complete a registration, navigate to the **Employees** page, select a user, and click **Camera**. The admin must capture/upload 10 distinct poses to achieve high-accuracy matches:
- *Poses*: Front, Left, Right, Looking Up, Looking Down, Smiling, Neutral, Indoor Light, Outdoor Light, Glasses (Optional).
- Reference embeddings are saved as L2-normalized 512-D float vectors inside PostgreSQL.

### 3. Kiosk Scanning & Liveness
When an employee stands in front of the kiosk webcam:
1. The system captures frames and scans for exactly one face (SCRFD).
2. Runs **Silent-Face-Anti-Spoofing** (MiniFASNet). If the liveness score is below `0.75`, the scan is rejected as a spoof (e.g. photos, phone screen).
3. Extracts the 512-D face embedding (ArcFace) and runs a **pgvector cosine distance** query:
   ```sql
   SELECT * FROM face_embeddings 
   ORDER BY embedding <=> :search_vector LIMIT 1;
   ```
4. Calculates similarity `1.0 - distance`. If similarity is $\ge 0.60$, the employee is identified.
5. Marks Check-In (first swipe) or Check-Out (subsequent swipes) and logs the entry.
6. Synthesizes a greeting offline using `pyttsx3` (Windows SAPI5 / Linux espeak) based on time-of-day:
   - `05:00 - 11:59`: "Good Morning"
   - `12:00 - 16:59`: "Good Afternoon"
   - `17:00 - 23:59`: "Good Evening"
