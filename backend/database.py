# database.py
# ═══════════════════════════════════════════════════════════════════════════════
# Database layer — stores student profiles and term-by-term results.
# Uses SQLite (zero config, no separate server needed).
# The database file is created automatically on first run.
# ═══════════════════════════════════════════════════════════════════════════════

import sqlite3
import json
import os
from datetime import datetime

DB_PATH = os.environ.get("DB_PATH", "student_reports.db")


def get_connection():
    """Get a database connection with row_factory for dict-like access."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")   # better concurrent reads
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """
    Create tables if they don't exist. Called once on server startup.
    Safe to call multiple times — CREATE IF NOT EXISTS.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # ── Students table ────────────────────────────────────────────────────
    # Each student has a unique ID. name + student_class is used for
    # matching when Gemini extracts a report card.
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS students (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            name            TEXT NOT NULL,
            student_class   TEXT,
            created_at      TEXT DEFAULT (datetime('now')),

            -- Simple auth: student logs in with name + a PIN they set
            pin_hash        TEXT,

            UNIQUE(name, student_class)
        )
    """)

    # ── Term Results table ────────────────────────────────────────────────
    # One row per term per student. Stores the full analysis snapshot.
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS term_results (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id          INTEGER NOT NULL,
            term                TEXT NOT NULL,
            upload_date         TEXT DEFAULT (datetime('now')),

            -- Raw scores (stored as JSON arrays/objects for flexibility)
            subjects_json       TEXT NOT NULL,
            average_score       REAL,
            weak_subjects_json  TEXT,
            strong_subjects_json TEXT,

            -- Behaviour
            behavior_json       TEXT,

            -- Attendance
            attendance_json     TEXT,

            -- Computed scores
            performance_score   REAL,
            academic_component  REAL,
            behaviour_component REAL,
            attendance_component REAL,

            -- Prediction
            prediction_label    TEXT,
            risk_score          INTEGER,
            warnings_json       TEXT,
            strengths_json      TEXT,

            -- Recommendations
            recommendations_json TEXT,

            FOREIGN KEY (student_id) REFERENCES students(id),
            UNIQUE(student_id, term)
        )
    """)

    conn.commit()
    conn.close()


# ══════════════════════════════════════════════════════════════════════════════
# STUDENT OPERATIONS
# ══════════════════════════════════════════════════════════════════════════════

def find_or_create_student(name: str, student_class: str = "") -> int:
    """
    Find a student by name+class, or create them if they don't exist.
    Returns the student ID.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # Try to find existing student
    cursor.execute(
        "SELECT id FROM students WHERE LOWER(name) = LOWER(?) AND LOWER(student_class) = LOWER(?)",
        (name.strip(), student_class.strip())
    )
    row = cursor.fetchone()

    if row:
        student_id = row["id"]
    else:
        cursor.execute(
            "INSERT INTO students (name, student_class) VALUES (?, ?)",
            (name.strip(), student_class.strip())
        )
        student_id = cursor.lastrowid
        conn.commit()

    conn.close()
    return student_id


def get_student_by_id(student_id: int) -> dict | None:
    """Get student info by ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM students WHERE id = ?", (student_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def list_students() -> list:
    """List all students in the database."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, student_class, created_at FROM students ORDER BY name")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ══════════════════════════════════════════════════════════════════════════════
# TERM RESULT OPERATIONS
# ══════════════════════════════════════════════════════════════════════════════

def save_term_result(student_id: int, analysis: dict) -> int:
    """
    Save a complete analysis result to the database.
    `analysis` is the dict returned by run_pipeline().
    Returns the term_result ID.
    """
    conn = get_connection()
    cursor = conn.cursor()

    term = analysis.get("term", "Unknown")

    # Check if this term already exists — update if so
    cursor.execute(
        "SELECT id FROM term_results WHERE student_id = ? AND term = ?",
        (student_id, term)
    )
    existing = cursor.fetchone()

    values = {
        "student_id":           student_id,
        "term":                 term,
        "subjects_json":        json.dumps(analysis.get("subjects", [])),
        "average_score":        analysis.get("average_score", 0),
        "weak_subjects_json":   json.dumps(analysis.get("weak_subjects", [])),
        "strong_subjects_json": json.dumps(analysis.get("strong_subjects", [])),
        "behavior_json":        json.dumps(analysis.get("behavior", [])),
        "attendance_json":      json.dumps(analysis.get("attendance", {})),
        "performance_score":    analysis.get("performance_score", 0),
        "academic_component":   analysis.get("academic_component", 0),
        "behaviour_component":  analysis.get("behaviour_component", 0),
        "attendance_component": analysis.get("attendance_component", 0),
        "prediction_label":     analysis.get("prediction", ""),
        "risk_score":           analysis.get("risk_score", 0),
        "warnings_json":        json.dumps(analysis.get("warnings", [])),
        "strengths_json":       json.dumps(analysis.get("strengths", [])),
        "recommendations_json": json.dumps(analysis.get("recommendations", [])),
    }

    if existing:
        set_clause = ", ".join(f"{k} = ?" for k in values.keys() if k != "student_id")
        vals = [v for k, v in values.items() if k != "student_id"]
        vals.append(existing["id"])
        cursor.execute(f"UPDATE term_results SET {set_clause} WHERE id = ?", vals)
        result_id = existing["id"]
    else:
        cols = ", ".join(values.keys())
        placeholders = ", ".join("?" for _ in values)
        cursor.execute(
            f"INSERT INTO term_results ({cols}) VALUES ({placeholders})",
            list(values.values())
        )
        result_id = cursor.lastrowid

    conn.commit()
    conn.close()
    return result_id


def get_student_history(student_id: int) -> list:
    """
    Get ALL past term results for a student, ordered oldest to newest.
    Each row is unpacked from JSON back into Python dicts/lists.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM term_results WHERE student_id = ? ORDER BY upload_date ASC",
        (student_id,)
    )
    rows = cursor.fetchall()
    conn.close()

    results = []
    for row in rows:
        r = dict(row)
        # Unpack JSON fields back to Python objects
        r["subjects"]        = json.loads(r.pop("subjects_json", "[]"))
        r["weak_subjects"]   = json.loads(r.pop("weak_subjects_json", "[]"))
        r["strong_subjects"] = json.loads(r.pop("strong_subjects_json", "[]"))
        r["behavior"]        = json.loads(r.pop("behavior_json", "[]"))
        r["attendance"]      = json.loads(r.pop("attendance_json", "{}"))
        r["warnings"]        = json.loads(r.pop("warnings_json", "[]"))
        r["strengths"]       = json.loads(r.pop("strengths_json", "[]"))
        r["recommendations"] = json.loads(r.pop("recommendations_json", "[]"))
        results.append(r)

    return results


def get_term_count(student_id: int) -> int:
    """How many terms of data do we have for this student?"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT COUNT(*) as cnt FROM term_results WHERE student_id = ?",
        (student_id,)
    )
    row = cursor.fetchone()
    conn.close()
    return row["cnt"] if row else 0