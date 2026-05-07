# main.py
# ═══════════════════════════════════════════════════════════════════════════════
# FastAPI server — now with database, student history, and trend-aware analysis.
#
# To run:
#   cd backend
#   uvicorn main:app --reload --port 8000
# ═══════════════════════════════════════════════════════════════════════════════

import os
import uuid
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from analyzer import run_pipeline
from database import (
    init_db, find_or_create_student, get_student_history,
    save_term_result, list_students, get_student_by_id, get_term_count
)

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables on first run."""
    init_db()
    yield

app = FastAPI(
    title="Student Report Analyzer",
    description="AI-powered student performance analysis with historical tracking",
    version="2.0.0",
    lifespan=lifespan
)

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 1: /upload — the main analysis endpoint (UPDATED)
#
# Flow:
#   1. Upload file → Gemini extracts student name + data
#   2. Find or create student in database
#   3. Fetch their past term results (history)
#   4. Re-run pipeline WITH history → trend engine activates
#   5. Save new results to database for next time
# ══════════════════════════════════════════════════════════════════════════════
@app.post("/upload")
def upload_and_analyze(file: UploadFile = File(...)):
    allowed = [".pdf", ".jpg", ".jpeg", ".png"]
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    file_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")

    try:
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        # Phase 1: Extract + analyze (ONE Gemini call, no history yet)
        result = run_pipeline(file_path, history=None)

        # Phase 2: Find or create student in database
        student_name = result.get("student_name", "Student")
        student_class = result.get("student_class", "")
        print(f"[LOG] Processing student: {student_name} ({student_class})")
        student_id = find_or_create_student(student_name, student_class)

        # Phase 3: If history exists, re-apply ONLY trend analysis (no 2nd Gemini call)
        history = get_student_history(student_id)
        if history:
            print(f"[LOG] Found {len(history)} past terms. Applying trend analysis...")
            result = run_pipeline(file_path, history=history, cached_result=result)

        # Phase 4: Save to database for future comparisons
        print("[LOG] Saving analysis to database...")
        save_term_result(student_id, result)

        # Attach metadata
        result["student_id"] = student_id
        result["terms_on_record"] = get_term_count(student_id)

        return result

    except ValueError as e:
        print(f"[ERROR] ValueError: {e}")
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 2: /students — list all students in the database
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/students")
async def get_students():
    students = list_students()
    for s in students:
        s["terms_on_record"] = get_term_count(s["id"])
    return {"students": students}


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 3: /students/{id}/history — full academic journey
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/students/{student_id}/history")
async def get_history(student_id: int):
    student = get_student_by_id(student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    history = get_student_history(student_id)
    return {
        "student": {"id": student["id"], "name": student["name"], "class": student["student_class"]},
        "terms_on_record": len(history),
        "history": history,
    }


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 4: /health
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "2.0.0", "message": "Student Report Analyzer with historical tracking is running"}