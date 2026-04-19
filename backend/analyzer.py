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

# ── Load .env file ───────────────────────────────────────────────────────────
# This reads your .env file and makes the keys available via os.environ
load_dotenv()

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY", "")

genai.configure(api_key=GEMINI_API_KEY)


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


# ══════════════════════════════════════════════════════════════════════════════
# STEP 1 — Load image (your Colab's load_report_image)
# ══════════════════════════════════════════════════════════════════════════════
def load_report_image(file_path):
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".pdf":
        pages = convert_from_path(file_path, dpi=300)
        image = pages[0]
    elif ext in [".jpg", ".jpeg", ".png"]:
        image = Image.open(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")
    return image


# ══════════════════════════════════════════════════════════════════════════════
# STEP 2 — Extract data via Gemini (your Colab's extract_report_data)
# ══════════════════════════════════════════════════════════════════════════════
def extract_report_data(image):
    import io
    buf = io.BytesIO()
    image.convert("RGB").save(buf, format="JPEG")
    image_bytes = buf.getvalue()
    image_part = {"mime_type": "image/jpeg", "data": image_bytes}
    model = genai.GenerativeModel('gemini-2.5-flash')
    response = model.generate_content([MASTER_PROMPT, image_part])
    raw = response.text.strip().replace("```json", "").replace("```", "").strip()
    try:
        data = json.loads(raw)
        return data
    except json.JSONDecodeError:
        raise ValueError(f"Gemini did not return valid JSON. Raw output: {raw[:500]}")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 3 — Performance Score (your Colab's calculate_performance_score)
# ══════════════════════════════════════════════════════════════════════════════
def calculate_performance_score(data):
    subjects   = data.get("subjects", [])
    behavior   = data.get("behavior", {}).get("extracted_ratings", {})
    attendance = data.get("attendance", {}).get("interpreted", {})

    # Academic (60%)
    scores = [s["score"] for s in subjects if isinstance(s.get("score"), (int, float))]
    academic_component = sum(scores) / len(scores) if scores else 0

    # Behaviour (25%)
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

    # Attendance (15%)
    att_pct      = attendance.get("attendance_percentage")
    days_present = attendance.get("days_present")
    total_days   = attendance.get("total_school_days")

    if att_pct is None and days_present and total_days:
        att_pct = round((days_present / total_days) * 100, 1)

    if att_pct is not None:
        attendance_component = min(att_pct, 100)
    else:
        attendance_component = academic_component

    # Weighted composite
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


# ══════════════════════════════════════════════════════════════════════════════
# STEP 4 — Prediction engine (your Colab's predict_performance)
# ══════════════════════════════════════════════════════════════════════════════
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

    # Signal 1: Average score (max 6 points)
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

    # Signal 2: Weak subjects (max 6 points)
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
        reasons.append(
            f"failing {weak_count} subjects: {', '.join(weak_subjects)} — "
            f"this is a critical number of failures"
        )

    if strong_count >= 6:
        positives.append(f"excelling in {strong_count} subjects")
    elif strong_count >= 3:
        positives.append(f"performing well in {strong_count} subjects")

    # Signal 3: Score consistency (max 2 points)
    if subjects:
        score_vals = [s["score"] for s in subjects if isinstance(s.get("score"), (int, float))]
        if len(score_vals) >= 2:
            score_range = max(score_vals) - min(score_vals)
            if score_range >= 50:
                risk_score += 2
                reasons.append(
                    f"very inconsistent results (lowest: {min(score_vals)}, "
                    f"highest: {max(score_vals)}, gap: {score_range} points)"
                )
            elif score_range >= 35:
                risk_score += 1
                reasons.append(
                    f"inconsistent results across subjects "
                    f"(range: {min(score_vals)}–{max(score_vals)})"
                )

    # Signal 4: Behaviour (max 4 points)
    extracted     = behavior_raw.get("extracted_ratings", {})
    low_behavior  = []
    high_behavior = []

    HIGH_IMPACT_KEYWORDS = {
        "attention", "attentive", "focus", "concentrate",
        "participat", "engage", "attitude", "conduct", "behavior", "behaviour"
    }

    for trait, values in extracted.items():
        normalized = values.get("normalized_score")
        raw        = values.get("raw_value", "")
        if normalized is None:
            continue
        is_high_impact = any(kw in trait.lower() for kw in HIGH_IMPACT_KEYWORDS)
        weight = 2 if is_high_impact else 1

        if normalized == 1:
            risk_score += weight + 1
            low_behavior.append(f"{trait}: {raw} (very poor)")
        elif normalized == 2:
            risk_score += weight
            low_behavior.append(f"{trait}: {raw}")
        elif normalized >= 4:
            high_behavior.append(f"{trait}: {raw}")

    if low_behavior:
        reasons.append(f"low behavioural ratings — {'; '.join(low_behavior)}")
    if high_behavior:
        positives.append(f"strong character ratings — {'; '.join(high_behavior)}")

    # Signal 5: Attendance (max 4 points)
    att_pct      = attendance.get("attendance_percentage")
    days_absent  = attendance.get("days_absent")
    days_present = attendance.get("days_present")
    total_days   = attendance.get("total_school_days")

    if att_pct is None and days_present and total_days:
        att_pct = round((days_present / total_days) * 100, 1)

    if att_pct is not None:
        absent_str = f"{int(days_absent)} sessions missed" if days_absent else ""
        if att_pct < 60:
            risk_score += 4
            reasons.append(
                f"dangerously low attendance of {att_pct}%"
                + (f" — {absent_str}" if absent_str else "")
                + ". The student is missing too much school to keep up"
            )
        elif att_pct < 70:
            risk_score += 3
            reasons.append(
                f"severely low attendance of {att_pct}%"
                + (f" ({absent_str})" if absent_str else "")
            )
        elif att_pct < 80:
            risk_score += 2
            reasons.append(
                f"below-average attendance of {att_pct}%"
                + (f" ({absent_str})" if absent_str else "")
            )
        elif att_pct < 90:
            risk_score += 1
            reasons.append(f"attendance of {att_pct}% could be improved")
        else:
            positives.append(f"excellent attendance of {att_pct}%")

    # Factor in composite score
    composite = performance_score["overall_score"]
    if composite < 40:
        risk_score += 2
        reasons.append(f"composite performance score is very low ({composite}/100)")
    elif composite < 55:
        risk_score += 1
        reasons.append(f"composite performance score is below average ({composite}/100)")
    elif composite >= 75:
        positives.append(f"strong composite performance score of {composite}/100")

    # Final label
    if risk_score >= 13:
        label   = "Severely At Risk"
        summary = (
            "This student is severely at risk and requires immediate intervention. "
            "Critical issues across multiple areas are combining to seriously "
            "threaten their academic future."
        )
    elif risk_score >= 8:
        label   = "At Risk"
        summary = (
            "The student is at risk of declining performance next term. "
            "Multiple warning signs indicate they need targeted support "
            "before the next term begins."
        )
    elif risk_score >= 4:
        label   = "Needs Improvement"
        summary = (
            "The student is managing but has clear areas that need attention. "
            "Addressing these now will prevent further decline next term."
        )
    elif strong_count >= 5 and avg >= 70 and risk_score <= 1:
        label   = "High Performer"
        summary = (
            "The student is performing at a high level and is on track "
            "to excel further next term."
        )
    else:
        label   = "On Track"
        summary = "The student is likely to maintain steady performance next term."

    return {
        "label":      label,
        "summary":    summary,
        "risk_score": risk_score,
        "risk_max":   20,
        "signals": {
            "academic_flags":   reasons,
            "positive_signals": positives
        }
    }


# ══════════════════════════════════════════════════════════════════════════════
# STEP 5 — YouTube API (your Colab's fetch_youtube_videos)
# ══════════════════════════════════════════════════════════════════════════════
def fetch_youtube_videos(query, max_results=3):
    if not YOUTUBE_API_KEY:
        return []

    url = "https://www.googleapis.com/youtube/v3/search"
    params = {
        "part":       "snippet",
        "q":          query,
        "type":       "video",
        "maxResults": max_results,
        "key":        YOUTUBE_API_KEY,
        "relevanceLanguage": "en",
        "safeSearch": "strict"
    }

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        items = response.json().get("items", [])
        videos = []
        for item in items:
            vid_id  = item["id"]["videoId"]
            title   = item["snippet"]["title"]
            thumb   = item["snippet"]["thumbnails"]["default"]["url"]
            videos.append({
                "title":     title,
                "url":       f"https://www.youtube.com/watch?v={vid_id}",
                "thumbnail": thumb
            })
        return videos
    except Exception:
        return []


# ══════════════════════════════════════════════════════════════════════════════
# STEP 6 — Recommendations (your Colab's generate_recommendations + helpers)
# ══════════════════════════════════════════════════════════════════════════════
def _weak_advice(subject, score, remark):
    lines = [f"{subject} needs urgent attention (score: {score}). "]
    if remark:
        lines.append(f"Your teacher noted: \"{remark}\". ")
    s = subject.lower()
    if any(w in s for w in ["math", "mathematics", "algebra", "calculus", "arithmetic"]):
        lines.append("Work through past questions daily and do not skip foundational topics. Focus on one concept at a time and use YouTube for worked examples.")
    elif any(w in s for w in ["english", "language", "literature", "writing", "reading", "comprehension"]):
        lines.append("Read one page daily to build comprehension. Practice writing short paragraphs and focus on grammar rules and vocabulary.")
    elif any(w in s for w in ["science", "biology", "chemistry", "physics", "basic science"]):
        lines.append("Use diagrams and videos to understand concepts visually. Focus on understanding over memorisation and watch experiment videos online.")
    elif any(w in s for w in ["history", "social", "citizenship", "civic", "geography"]):
        lines.append("Create summary sheets per topic and relate events to real life. Review past exam questions to understand what is expected.")
    elif any(w in s for w in ["french", "arabic", "yoruba", "igbo", "hausa"]):
        lines.append("Practice at least 10 minutes daily. Use flashcards for vocabulary and watch simple videos in that language.")
    elif any(w in s for w in ["computer", "digital", "ict", "technology", "literacy"]):
        lines.append("Practice on a computer whenever possible. Search YouTube for the specific topic you are struggling with.")
    elif any(w in s for w in ["art", "creative", "craft", "cultural"]):
        lines.append("Practice regularly and study the examples given in class. Try to replicate techniques at home.")
    elif any(w in s for w in ["physical", "health", "sport", "pe", "exercise"]):
        lines.append("Review theory components carefully as these are tested in exams. Stay consistent with physical practice.")
    elif any(w in s for w in ["religious", "christian", "islamic", "bible", "moral"]):
        lines.append("Read and summarise key teachings regularly. Focus on understanding moral lessons and review past exam questions.")
    elif any(w in s for w in ["vocation", "vocational", "pre-voc", "prevoc", "handwork"]):
        lines.append("Focus on the practical skills and practise them regularly. Review written components using class notes.")
    else:
        lines.append("Review class notes and past questions regularly. Ask your teacher for extra guidance on the hardest topics.")
    return "".join(lines)


def _strong_advice(subject, score, remark):
    lines = [f"Excellent performance in {subject} (score: {score}). "]
    if remark:
        lines.append(f"Your teacher noted: \"{remark}\". ")
    s = subject.lower()
    if any(w in s for w in ["math", "mathematics", "algebra", "calculus"]):
        lines.append("Challenge yourself with advanced problem types — word problems, logic puzzles, or introductory algebra and statistics.")
    elif any(w in s for w in ["english", "language", "literature", "writing"]):
        lines.append("Push further by writing essays or book reviews. Read more challenging texts to strengthen comprehension.")
    elif any(w in s for w in ["science", "biology", "chemistry", "physics"]):
        lines.append("Explore beyond the curriculum with science documentaries or simple experiments. This foundation will serve you well in senior school.")
    elif any(w in s for w in ["history", "social", "citizenship", "geography"]):
        lines.append("Deepen understanding by reading about current events and connecting them to what you have learned.")
    elif any(w in s for w in ["french", "language", "igbo", "yoruba", "hausa"]):
        lines.append("Maintain your strength by practising conversation and writing. Try reading simple books in this language.")
    elif any(w in s for w in ["computer", "digital", "ict", "technology"]):
        lines.append("Explore basic coding or digital projects. Platforms like Scratch or Code.org are great next steps.")
    elif any(w in s for w in ["art", "creative", "cultural"]):
        lines.append("Keep experimenting with different styles and techniques. Consider entering school competitions or showcasing your work.")
    else:
        lines.append("Keep up the excellent work. Consider helping peers who struggle — teaching others deepens your own understanding.")
    return "".join(lines)


def generate_recommendations(data, prediction):
    subjects    = data.get("subjects", [])
    weak_list   = data.get("weak_subjects", [])
    strong_list = data.get("strong_subjects", [])
    subject_map = {s["name"]: s for s in subjects}

    recs = []

    for name in weak_list:
        s       = subject_map.get(name, {})
        score   = s.get("score", "N/A")
        remark  = s.get("teacher_remark")
        query   = f"{name} tutorial lesson for students"
        videos  = fetch_youtube_videos(query, max_results=3)
        advice  = _weak_advice(name, score, remark)

        recs.append({
            "subject":        name,
            "score":          score,
            "type":           "improvement",
            "teacher_remark": remark,
            "advice":         advice,
            "youtube_query":  query,
            "videos":         videos
        })

    for name in strong_list:
        s       = subject_map.get(name, {})
        score   = s.get("score", "N/A")
        remark  = s.get("teacher_remark")
        query   = f"advanced {name} for students"
        videos  = fetch_youtube_videos(query, max_results=2)
        advice  = _strong_advice(name, score, remark)

        recs.append({
            "subject":        name,
            "score":          score,
            "type":           "enrichment",
            "teacher_remark": remark,
            "advice":         advice,
            "youtube_query":  query,
            "videos":         videos
        })

    return recs


# ══════════════════════════════════════════════════════════════════════════════
# MASTER FUNCTION — called by FastAPI's /upload endpoint
# ══════════════════════════════════════════════════════════════════════════════
def run_pipeline(file_path: str) -> dict:
    """
    This is the ONE function FastAPI calls.
    It chains all steps and returns a single JSON dict
    shaped exactly how the React dashboard expects it.
    """
    # Run your existing pipeline
    image           = load_report_image(file_path)
    data            = extract_report_data(image)
    perf_score      = calculate_performance_score(data)
    prediction      = predict_performance(data, perf_score)
    recommendations = generate_recommendations(data, prediction)

    # ── Build the response for the React dashboard ───────────────────────────
    subjects     = data.get("subjects", [])
    behavior_raw = data.get("behavior", {})
    attendance   = data.get("attendance", {}).get("interpreted", {})

    # Build behavior list for the dashboard
    behavior_list = []
    for trait, values in behavior_raw.get("extracted_ratings", {}).items():
        behavior_list.append({
            "trait":  trait,
            "rating": values.get("normalized_score", 0),
            "raw_value": values.get("raw_value", "")
        })

    return {
        # Student info
        "student_name":  data.get("student", {}).get("name", "Student"),
        "student_class": data.get("student", {}).get("class", ""),
        "term":          data.get("student", {}).get("term", ""),

        # Subjects
        "subjects": [
            {
                "name":           s["name"],
                "score":          s["score"],
                "remark":         s.get("teacher_remark") or s.get("grade") or "N/A"
            }
            for s in subjects
        ],
        "average_score":   data.get("average_score", 0),
        "weak_subjects":   data.get("weak_subjects", []),
        "strong_subjects": data.get("strong_subjects", []),

        # Performance score
        "performance_score":    perf_score["overall_score"],
        "academic_component":   perf_score["breakdown"]["academic_score"],
        "behaviour_component":  perf_score["breakdown"]["behaviour_score"],
        "attendance_component": perf_score["breakdown"]["attendance_score"],

        # Behaviour
        "behavior": behavior_list,

        # Attendance
        "attendance": {
            "present":    attendance.get("days_present", 0),
            "absent":     attendance.get("days_absent", 0),
            "total":      attendance.get("total_school_days", 0),
            "percentage": attendance.get("attendance_percentage", 0),
        },

        # Prediction
        "prediction":  prediction["label"],
        "risk_score":  prediction["risk_score"],
        "risk_max":    prediction["risk_max"],
        "summary":     prediction["summary"],
        "warnings":    prediction["signals"]["academic_flags"],
        "strengths":   prediction["signals"]["positive_signals"],

        # Recommendations (includes YouTube videos)
        "recommendations": recommendations,
    }