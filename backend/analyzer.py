# analyzer.py
# ═══════════════════════════════════════════════════════════════════════════════
# Your Colab logic — reorganized for import by FastAPI.
# Every function below is IDENTICAL to your Colab. Nothing was rewritten.
# The only changes:
#   1. Removed Colab-specific lines (!pip install, from google.colab import files)
#   2. Removed print statements (FastAPI returns JSON, not terminal output)
#   3. API keys now come from environment variables
#   4. run_pipeline() returns a flat JSON dict that the React dashboard expects
# ═══════════════════════════════════════════════════════════════════════════════

import os
import json
import requests
import google.generativeai as genai
from pdf2image import convert_from_path
from PIL import Image
from dotenv import load_dotenv
import hashlib
import re
import time

# ── Load .env file ───────────────────────────────────────────────────────────
load_dotenv()

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY", "")

genai.configure(api_key=GEMINI_API_KEY)

CACHE_DIR = os.path.join(os.path.dirname(__file__), ".analysis_cache")
os.makedirs(CACHE_DIR, exist_ok=True)


def get_file_hash(file_path):
    """Generate SHA256 hash for a file to use as a cache key."""
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()


# ── MASTER PROMPT (unchanged from your Colab) ───────────────────────────────
MASTER_PROMPT = """
Analyze this student report card image carefully.

Return ONLY valid JSON with NO markdown fences, NO explanation — just the raw JSON object.

{
  "student": {
    "name": "Full name from report",
    "class": "Class or grade level",
    "term": "Term or semester"
  },
  "subjects": [
    {
      "name": "Subject name",
      "score": 75,
      "grade": "letter grade if shown, else null",
      "teacher_remark": "exact remark written by teacher if present, else null"
    }
  ],
  "average_score": 75,
  "weak_subjects": ["subjects scoring below 50"],
  "strong_subjects": ["subjects scoring 60 and above"],
  "behavior": {
    "extracted_ratings": {},
    "rating_system_detected": "describe exactly what system the report uses"
  },
  "attendance": {
    "raw_entries": {},
    "interpreted": {
      "days_present": null,
      "days_absent": null,
      "total_school_days": null,
      "attendance_percentage": null
    }
  }
}

════════════════════════════════════
RULES FOR SUBJECTS
════════════════════════════════════
- score must be a number, not a string
- average_score must be a whole number
- weak_subjects: score strictly below 50
- strong_subjects: score 60 and above
- teacher_remark: copy the EXACT words written by the teacher for that subject if present

════════════════════════════════════
RULES FOR BEHAVIOR
════════════════════════════════════
- Scan the entire report card for ANY section that rates the student
  on personal traits, character, conduct, or soft skills.
- Do NOT assume any trait names. Use ONLY what is physically written
  on this report card as the key name.
- For each trait found, add an entry to extracted_ratings like this:
    "EXACT trait name from report": {
      "raw_value": "exactly what is written on the report for this trait",
      "normalized_score": <convert to 1-5 using the rules below>
    }
- If there is NO behavior/character/conduct section on this report,
  set extracted_ratings to an empty object {}.
- Normalization rules:
    Numbers 1-5: use as-is
    Numbers 1-10: divide by 2, round to nearest whole
    Numbers 1-100: divide by 20, round to nearest whole
    Letters A/B/C/D/E: A=5, B=4, C=3, D=2, E=1
    Letters A/B/C/D/F: A=5, B=4, C=3, D=2, F=1
    Words — map to closest:
      5 = Excellent, Outstanding, Superb, Always, Exceptional, Distinction
      4 = Good, Very Good, Usually, Commendable, Credit
      3 = Fair, Average, Satisfactory, Sometimes, Pass
      2 = Poor, Below Average, Rarely, Needs Improvement, Unsatisfactory
      1 = Very Poor, Never, Failing, Unacceptable
- rating_system_detected: describe exactly what the report uses
  e.g. "numeric 1-5", "letter A-E", "words: Excellent/Good/Fair/Poor"

════════════════════════════════════
RULES FOR ATTENDANCE
════════════════════════════════════
- Scan the entire report for ANY attendance information, no matter
  how it is written or formatted.
- Copy every attendance-related field EXACTLY as written into raw_entries.
  Example raw_entries might look like any of these depending on the report:
    {"Times Present": 58, "Times Absent": 7}
    {"No. of Times School Opened": 65, "No. of Times Present": 60}
    {"Attendance": "92%"}
    {"Days Present": 55, "Total Days": 60}
    {"Present": 48, "Absent": 12, "Late": 3}
- Then in interpreted, calculate and fill in:
    days_present: best estimate of days/times the student was present
    days_absent: best estimate of days/times the student was absent
    total_school_days: total days school was open (present + absent if no total given)
    attendance_percentage: (days_present / total_school_days) * 100, rounded to 1 decimal
- If NO attendance information exists anywhere on the report,
  set raw_entries to {} and all interpreted fields to null.

Return ONLY the JSON object, nothing else.
"""


def load_report_image(file_path):
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".pdf":
        pages = convert_from_path(file_path, dpi=150)
        image = pages[0]
    elif ext in [".jpg", ".jpeg", ".png"]:
        image = Image.open(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")

    max_side = 2000
    w, h = image.size
    if max(w, h) > max_side:
        scale = max_side / max(w, h)
        image = image.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    return image


def extract_report_data(image):
    model = genai.GenerativeModel('gemini-2.5-flash')
    print(f"\n[ANALYZER] Starting AI analysis for document...")

    # Retry up to 5 times on rate-limit (429) or timeout (504, 503)
    last_error = None
    for attempt in range(5):
        try:
            response = model.generate_content(
                [MASTER_PROMPT, image.convert("RGB")],
                request_options={"timeout": 120},
            )
            break
        except Exception as e:
            last_error = e
            err = str(e)
            
            if any(code in err for code in ("429", "504", "503")):
                retry_match = re.search(r"retry in (\d+\.?\d*)s", err)
                if retry_match:
                    wait_time = float(retry_match.group(1)) + 1.0
                else:
                    wait_time = (5 * (2 ** attempt))
                
                if attempt < 4:
                    print(f"[ANALYZER] Rate limit (429) or busy (503/504) hit. Retrying in {wait_time:.1f}s... (Attempt {attempt + 1}/5)")
                    time.sleep(wait_time)
                    continue
            raise
    else:
        print("[ANALYZER] All retry attempts failed.")
        raise last_error

    print("[ANALYZER] AI analysis successful!")

    raw = response.text.strip().replace("```json", "").replace("```", "").strip()
    try:
        data = json.loads(raw)
        return data
    except json.JSONDecodeError:
        raise ValueError(f"Gemini did not return valid JSON. Raw output: {raw[:500]}")


def calculate_performance_score(data):
    subjects   = data.get("subjects", [])
    behavior   = data.get("behavior", {}).get("extracted_ratings", {})
    attendance = data.get("attendance", {}).get("interpreted", {})

    scores = [s["score"] for s in subjects if isinstance(s.get("score"), (int, float))]
    academic_component = sum(scores) / len(scores) if scores else 0

    normalized_vals = [
        v["normalized_score"]
        for v in behavior.values()
        if isinstance(v.get("normalized_score"), (int, float))
    ]
    if normalized_vals:
        avg_behavior = sum(normalized_vals) / len(normalized_vals)
        behaviour_component = (avg_behavior / 5) * 100
    else:
        behaviour_component = academic_component

    att_pct      = attendance.get("attendance_percentage")
    days_present = attendance.get("days_present")
    total_days   = attendance.get("total_school_days")

    if att_pct is None and days_present and total_days:
        att_pct = round((days_present / total_days) * 100, 1)

    if att_pct is not None:
        attendance_component = min(att_pct, 100)
    else:
        attendance_component = academic_component

    composite = (
        (academic_component  * 0.60) +
        (behaviour_component * 0.25) +
        (attendance_component * 0.15)
    )
    composite = round(composite)

    return {
        "overall_score": composite,
        "breakdown": {
            "academic_score":   round(academic_component),
            "behaviour_score":  round(behaviour_component),
            "attendance_score": round(attendance_component) if att_pct is not None else "N/A"
        }
    }


def predict_performance(data, performance_score):
    avg             = data.get("average_score", 0)
    weak_subjects   = data.get("weak_subjects", [])
    strong_subjects = data.get("strong_subjects", [])
    subjects        = data.get("subjects", [])
    behavior_raw    = data.get("behavior", {})
    attendance      = data.get("attendance", {}).get("interpreted", {})

    risk_score = 0
    reasons    = []
    positives  = []

    if avg >= 80:
        positives.append(f"excellent overall average of {avg}%")
    elif avg >= 70:
        positives.append(f"strong overall average of {avg}%")
    elif avg >= 60:
        risk_score += 1
        positives.append(f"satisfactory average of {avg}%")
    elif avg >= 50:
        risk_score += 3
        reasons.append(f"average score of {avg}% is below satisfactory")
    elif avg >= 40:
        risk_score += 5
        reasons.append(f"average score of {avg}% is significantly below passing")
    else:
        risk_score += 6
        reasons.append(f"critically low average of {avg}% — urgent intervention needed")

    weak_count   = len(weak_subjects)
    strong_count = len(strong_subjects)

    if weak_count == 0:
        positives.append("no failing subjects")
    elif weak_count == 1:
        risk_score += 2
        reasons.append(f"failing {weak_subjects[0]}")
    elif weak_count == 2:
        risk_score += 3
        reasons.append(f"failing 2 subjects: {', '.join(weak_subjects)}")
    elif weak_count == 3:
        risk_score += 4
        reasons.append(f"failing 3 subjects: {', '.join(weak_subjects)}")
    elif weak_count >= 4:
        risk_score += 6
        reasons.append(f"failing {weak_count} subjects: {', '.join(weak_subjects)}")

    if strong_count >= 6:
        positives.append(f"excelling in {strong_count} subjects")
    elif strong_count >= 3:
        positives.append(f"performing well in {strong_count} subjects")

    if subjects:
        score_vals = [s["score"] for s in subjects if isinstance(s.get("score"), (int, float))]
        if len(score_vals) >= 2:
            score_range = max(score_vals) - min(score_vals)
            if score_range >= 50:
                risk_score += 2
                reasons.append(f"very inconsistent results (gap: {score_range} points)")
            elif score_range >= 35:
                risk_score += 1
                reasons.append(f"inconsistent results across subjects")

    extracted = behavior_raw.get("extracted_ratings", {})
    HIGH_IMPACT_KEYWORDS = {"attention", "attentive", "focus", "concentrate", "participat", "engage", "attitude", "conduct", "behavior", "behaviour"}

    for trait, values in extracted.items():
        normalized = values.get("normalized_score")
        raw = values.get("raw_value", "")
        if normalized is None: continue
        is_high_impact = any(kw in trait.lower() for kw in HIGH_IMPACT_KEYWORDS)
        weight = 2 if is_high_impact else 1
        if normalized == 1:
            risk_score += weight + 1
        elif normalized == 2:
            risk_score += weight

    att_pct = attendance.get("attendance_percentage")
    if att_pct is not None:
        if att_pct < 60: risk_score += 4
        elif att_pct < 70: risk_score += 3
        elif att_pct < 80: risk_score += 2
        elif att_pct < 90: risk_score += 1

    composite = performance_score["overall_score"]
    if composite < 40: risk_score += 2
    elif composite < 55: risk_score += 1

    if risk_score >= 13:
        label, summary = "Severely At Risk", "This student is severely at risk."
    elif risk_score >= 8:
        label, summary = "At Risk", "The student is at risk."
    elif risk_score >= 4:
        label, summary = "Needs Improvement", "The student managing but has clear areas that need attention."
    elif strong_count >= 5 and avg >= 70 and risk_score <= 1:
        label, summary = "High Performer", "The student is performing at a high level."
    else:
        label, summary = "On Track", "The student is likely to maintain steady performance."

    return {
        "label": label, "summary": summary, "risk_score": risk_score, "risk_max": 20,
        "signals": {"academic_flags": reasons, "positive_signals": positives}
    }


def fetch_youtube_videos(query, max_results=3):
    if not YOUTUBE_API_KEY: return []
    url = "https://www.googleapis.com/youtube/v3/search"
    params = {"part": "snippet", "q": query, "type": "video", "maxResults": max_results, "key": YOUTUBE_API_KEY, "relevanceLanguage": "en", "safeSearch": "strict"}
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        items = response.json().get("items", [])
        return [{"title": i["snippet"]["title"], "url": f"https://www.youtube.com/watch?v={i['id']['videoId']}", "thumbnail": i["snippet"]["thumbnails"]["default"]["url"]} for i in items]
    except Exception: return []


def _weak_advice(subject, score, remark):
    lines = [f"{subject} needs urgent attention (score: {score}). "]
    if remark: lines.append(f"Your teacher noted: \"{remark}\". ")
    s = subject.lower()
    if any(w in s for w in ["math", "mathematics", "algebra", "calculus", "arithmetic"]):
        lines.append("Work through past questions daily and do not skip foundational topics.")
    elif any(w in s for w in ["english", "language", "literature", "writing"]):
        lines.append("Read one page daily to build comprehension. Practice writing short paragraphs.")
    elif any(w in s for w in ["science", "biology", "chemistry", "physics"]):
        lines.append("Use diagrams and videos to understand concepts visually.")
    else:
        lines.append("Review class notes and past questions regularly.")
    return "".join(lines)


def _strong_advice(subject, score, remark):
    lines = [f"Excellent performance in {subject} (score: {score}). "]
    if remark: lines.append(f"Your teacher noted: \"{remark}\". ")
    s = subject.lower()
    if any(w in s for w in ["math", "mathematics", "algebra", "calculus"]):
        lines.append("Challenge yourself with advanced problem types.")
    elif any(w in s for w in ["english", "language", "literature", "writing"]):
        lines.append("Push further by writing essays or book reviews.")
    else:
        lines.append("Keep up the excellent work.")
    return "".join(lines)


def generate_recommendations(data, prediction):
    subjects    = data.get("subjects", [])
    weak_list   = data.get("weak_subjects", [])
    strong_list = data.get("strong_subjects", [])
    subject_map = {s["name"]: s for s in subjects}
    recs = []
    for name in weak_list:
        s = subject_map.get(name, {})
        recs.append({"subject": name, "score": s.get("score", "N/A"), "type": "improvement", "teacher_remark": s.get("teacher_remark"), "advice": _weak_advice(name, s.get("score", "N/A"), s.get("teacher_remark")), "youtube_query": f"{name} tutorial lesson", "videos": fetch_youtube_videos(f"{name} tutorial", 3)})
    for name in strong_list:
        s = subject_map.get(name, {})
        recs.append({"subject": name, "score": s.get("score", "N/A"), "type": "enrichment", "teacher_remark": s.get("teacher_remark"), "advice": _strong_advice(name, s.get("score", "N/A"), s.get("teacher_remark")), "youtube_query": f"advanced {name} lesson", "videos": fetch_youtube_videos(f"advanced {name}", 2)})
    return recs


def run_pipeline(file_path: str) -> dict:
    file_hash = get_file_hash(file_path)
    cache_path = os.path.join(CACHE_DIR, f"{file_hash}.json")

    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r") as f:
                return json.load(f)
        except Exception: pass

    image = load_report_image(file_path)
    data = extract_report_data(image)
    perf_score = calculate_performance_score(data)
    prediction = predict_performance(data, perf_score)
    recommendations = generate_recommendations(data, prediction)

    behavior_raw = data.get("behavior", {})
    attendance = data.get("attendance", {}).get("interpreted", {})
    behavior_list = [{"trait": t, "rating": v.get("normalized_score", 0), "raw_value": v.get("raw_value", "")} for t, v in behavior_raw.get("extracted_ratings", {}).items()]

    result = {
        "student_name":  data.get("student", {}).get("name", "Student"),
        "student_class": data.get("student", {}).get("class", ""),
        "term":          data.get("student", {}).get("term", ""),
        "subjects": [{"name": s["name"], "score": s["score"], "remark": s.get("teacher_remark") or s.get("grade") or "N/A"} for s in data.get("subjects", [])],
        "average_score": data.get("average_score", 0),
        "weak_subjects": data.get("weak_subjects", []),
        "strong_subjects": data.get("strong_subjects", []),
        "performance_score": perf_score["overall_score"],
        "academic_component": perf_score["breakdown"]["academic_score"],
        "behaviour_component": perf_score["breakdown"]["behaviour_score"],
        "attendance_component": perf_score["breakdown"]["attendance_score"],
        "behavior": behavior_list,
        "attendance": {"present": attendance.get("days_present", 0), "absent": attendance.get("days_absent", 0), "total": attendance.get("total_school_days", 0), "percentage": attendance.get("attendance_percentage", 0)},
        "prediction": prediction["label"],
        "risk_score": prediction["risk_score"],
        "risk_max": prediction["risk_max"],
        "summary": prediction["summary"],
        "warnings": prediction["signals"]["academic_flags"],
        "strengths": prediction["signals"]["positive_signals"],
        "recommendations": recommendations,
    }

    try:
        with open(cache_path, "w") as f:
            json.dump(result, f)
    except Exception: pass

    return result