# main.py
# ═══════════════════════════════════════════════════════════════════════════════
# FastAPI server — connects your Colab logic to the React dashboard.
#
# To run:
#   cd backend
#   export GEMINI_API_KEY="your-key"
#   export YOUTUBE_API_KEY="your-key"
#   uvicorn main:app --reload --port 8000
#
# Then open http://localhost:8000/docs to test with Swagger UI.
# ═══════════════════════════════════════════════════════════════════════════════

import os
import uuid
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse

from analyzer import run_pipeline

app = FastAPI(
    title="Student Report Analyzer",
    description="Upload a student report card and get AI-powered analysis",
    version="1.0.0"
)

# ── CORS — allow your React dev server to call this API ──────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite default
        "http://localhost:3000",   # CRA default
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Create uploads folder if it doesn't exist ────────────────────────────────
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 0: / — redirect to interactive API docs
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/")
async def root():
    return RedirectResponse(url="/docs")


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 1: /upload — accepts a file, runs the full pipeline, returns JSON
# ══════════════════════════════════════════════════════════════════════════════
@app.post("/upload")
async def upload_and_analyze(file: UploadFile = File(...)):
    """
    Upload a student report card (PDF, JPG, or PNG).
    Returns the full analysis as JSON — this is what the React dashboard consumes.
    """
    # Validate file type
    allowed_extensions = [".pdf", ".jpg", ".jpeg", ".png"]
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Upload PDF, JPG, or PNG."
        )

    # Save uploaded file to a temp location
    file_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")

    try:
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        # Run your entire Colab pipeline
        result = run_pipeline(file_path)

        return result

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        err_msg = str(e)
        if "429" in err_msg:
            raise HTTPException(
                status_code=429,
                detail="Google Gemini is currently busy (Rate Limit). We attempted to retry several times, but the limit is still active. Please wait a few minutes before trying again."
            )
        raise HTTPException(status_code=500, detail=f"Analysis failed: {err_msg}")
    finally:
        # Clean up the temp file
        if os.path.exists(file_path):
            os.remove(file_path)


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 2: /health — simple check that the server is running
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "Student Report Analyzer is running"}