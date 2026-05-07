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
    print(f"[LOG] Loading image: {file_path}")
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".pdf":
        print("[LOG] Converting PDF to image...")
        pages = convert_from_path(file_path, dpi=300, fmt='jpeg')
        image = pages[0]
    elif ext in [".jpg", ".jpeg", ".png"]:
        print("[LOG] Opening image file...")
        image = Image.open(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")
    return image


# ══════════════════════════════════════════════════════════════════════════════
# STEP 2 — Extract data via Gemini (your Colab's extract_report_data)
# ══════════════════════════════════════════════════════════════════════════════
def extract_report_data(image):
    import time
    from google.api_core.exceptions import ResourceExhausted
    
    print("[LOG] Calling Gemini API (gemini-2.5-flash)...")
    model = genai.GenerativeModel(
        model_name='gemini-2.5-flash',
        safety_settings=[
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
        ]
    )
    
    # Retry with backoff for rate limit errors
    max_retries = 3
    for attempt in range(max_retries + 1):
        try:
            response = model.generate_content(
                [MASTER_PROMPT, image],
                request_options={"timeout": 600}
            )
            break  # Success — exit retry loop
        except ResourceExhausted as e:
            if attempt < max_retries:
                wait = 35 * (2 ** attempt)  # 35s, 70s, 140s
                print(f"[LOG] Rate limited (429). Retrying in {wait}s... (attempt {attempt + 1}/{max_retries})")
                time.sleep(wait)
            else:
                print("[LOG] ERROR: Rate limit exceeded after all retries.")
                raise ValueError(f"Gemini API rate limit exceeded. Please wait a minute and try again. Details: {str(e)[:200]}")
    
    print("[LOG] Gemini response received.")
    
    # Check if the response was blocked
    if not response.candidates:
         print("[LOG] ERROR: No candidates returned (possibly blocked).")
         raise ValueError("Gemini returned no results. This usually happens if the content is blocked by safety filters.")
         
    raw = response.text.strip().replace("```json", "").replace("```", "").strip()
    try:
        data = json.loads(raw)
        return data
    except json.JSONDecodeError:
        print(f"[LOG] ERROR: Invalid JSON from Gemini. Raw: {raw[:200]}")
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
    import json
    import os
    
    if not YOUTUBE_API_KEY:
        return []

    # 1. Check Cache
    CACHE_FILE = "youtube_cache.json"
    cache = {}
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                cache = json.load(f)
        except Exception:
            pass
            
    if query in cache:
        print(f"[LOG] YouTube Cache HIT for: '{query}'")
        return cache[query]
        
    print(f"[LOG] YouTube Cache MISS. Calling API for: '{query}'")

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
            
        # 2. Save to Cache
        cache[query] = videos
        try:
            with open(CACHE_FILE, "w") as f:
                json.dump(cache, f)
        except Exception:
            pass
            
        return videos
    except Exception as e:
        print(f"[LOG] YouTube API Error: {e}")
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


def generate_recommendations(data, prediction, subject_trends=None):
    """
    Generate recommendations. If subject_trends is provided (from trend_engine),
    use tiered recommendations based on historical patterns.
    Otherwise, fall back to the original single-term logic.
    """
    subjects    = data.get("subjects", [])
    weak_list   = data.get("weak_subjects", [])
    strong_list = data.get("strong_subjects", [])
    student_class = data.get("student_class", "")
    subject_map = {s["name"]: s for s in subjects}
    trends      = subject_trends or []

    # Make queries class-specific if the class is known
    class_suffix = f" for {student_class} students" if student_class else " for students"

    recs = []

    for name in weak_list:
        s       = subject_map.get(name, {})
        score   = s.get("score", "N/A")
        remark  = s.get("teacher_remark")

        # Determine tier from history
        tier = _get_tier(name, score, trends)
        advice = _tiered_weak_advice(name, score, remark, tier, trends)
        query  = f"{name} tutorial lesson{class_suffix}"
        videos = fetch_youtube_videos(query, max_results=3)

        recs.append({
            "subject":        name,
            "score":          score,
            "type":           "improvement",
            "tier":           tier,
            "teacher_remark": remark,
            "advice":         advice,
            "youtube_query":  query,
            "videos":         videos
        })

    for name in strong_list:
        s       = subject_map.get(name, {})
        score   = s.get("score", "N/A")
        remark  = s.get("teacher_remark")

        tier = _get_tier(name, score, trends)
        advice = _tiered_strong_advice(name, score, remark, tier, trends)

        if tier == "exceptional":
            query = f"advanced {name} olympiad competition{class_suffix}"
        else:
            query = f"advanced {name}{class_suffix}"
        videos = fetch_youtube_videos(query, max_results=2)

        recs.append({
            "subject":        name,
            "score":          score,
            "type":           "enrichment",
            "tier":           tier,
            "teacher_remark": remark,
            "advice":         advice,
            "youtube_query":  query,
            "videos":         videos
        })

    return recs


def _get_tier(subject_name, current_score, trends):
    """Get the recommendation tier from trend data, or default by score."""
    # Import here to avoid circular imports
    from trend_engine import get_recommendation_tier
    if trends:
        return get_recommendation_tier(subject_name, current_score, trends)
    # No history — tier by score alone
    if current_score >= 80: return "strong_stable"
    elif current_score >= 60: return "strong_stable"
    elif current_score >= 50: return "moderate"
    else: return "weak"


# ══════════════════════════════════════════════════════════════════════════════
# TIERED RECOMMENDATION ADVICE
# These replace the old _weak_advice and _strong_advice with history-aware
# versions. The old functions are kept as fallbacks inside the new ones.
# ══════════════════════════════════════════════════════════════════════════════

def _tiered_weak_advice(subject, score, remark, tier, trends):
    """
    Generate advice for a weak subject (<50), adjusted by tier.
    """
    # Find trend data for this subject
    trend_info = _find_trend(subject, trends)

    lines = []

    if tier == "persistently_weak" and trend_info:
        terms = trend_info.get("terms_tracked", 2)
        lines.append(f"{subject} has been below passing for {terms} consecutive terms (current: {score}%). ")
        if remark:
            lines.append(f"Your teacher noted: \"{remark}\". ")
        lines.append("The current study approach is not working and needs a fundamental change. ")
        lines.append("Consider requesting one-on-one sessions with your teacher, starting from the very basics of this subject rather than the current syllabus. ")
        lines.append("A tutor or study group focused specifically on this subject is strongly recommended. ")
        lines.append("Break the material into the smallest possible units and master each one before moving on.")
    elif tier == "newly_struggling" and trend_info:
        prev = trend_info.get("previous_score", "?")
        lines.append(f"{subject} dropped from {prev}% to {score}% — this is a new struggle. ")
        if remark:
            lines.append(f"Your teacher noted: \"{remark}\". ")
        lines.append("Since you performed better before, the knowledge foundation is there. ")
        lines.append("Identify what changed — new teacher, missed classes, harder topics — and address that specific cause. ")
        lines.append("Review the topics covered this term and compare with what you knew before.")
    elif tier == "improving" and trend_info:
        prev = trend_info.get("previous_score", "?")
        delta = trend_info.get("delta", 0)
        lines.append(f"{subject} is still below passing at {score}%, but you improved by {delta} points from {prev}%. ")
        if remark:
            lines.append(f"Your teacher noted: \"{remark}\". ")
        lines.append("This is real progress — whatever you are doing differently is working. Keep it up. ")
        lines.append("Stay consistent with your current study routine and aim to cross 50% next term.")
    else:
        # Default: use the original weak advice
        return _weak_advice(subject, score, remark)

    return "".join(lines)


def _tiered_strong_advice(subject, score, remark, tier, trends):
    """
    Generate advice for a strong subject (60%+), adjusted by tier.
    Exceptional students get told to take higher classes and tutor peers.
    """
    trend_info = _find_trend(subject, trends)
    lines = []

    if tier == "exceptional" and trend_info:
        terms = trend_info.get("terms_tracked", 2)
        lines.append(f"Outstanding: {subject} has been above 80% for {terms} consecutive terms (current: {score}%). ")
        if remark:
            lines.append(f"Your teacher noted: \"{remark}\". ")
        lines.append("You have mastered this subject at your current level. Here is what to do next: ")
        lines.append("1) Take higher-level or advanced classes in {subject} if your school offers them — you are ready. ".format(subject=subject))
        lines.append("2) Tutor your peers who are struggling — teaching is the deepest form of learning and will strengthen your own understanding even further. ")
        lines.append("3) Enter competitions, quizzes, or olympiads in this subject area — these challenge you beyond the syllabus and look excellent on academic records. ")
        lines.append("4) Explore related subjects or career paths that build on this strength. You have a genuine talent here.")
    elif tier == "strong_and_improving" and trend_info:
        delta = trend_info.get("delta", 0)
        lines.append(f"Excellent: {subject} improved by {delta} points to {score}% and is now one of your strongest areas. ")
        if remark:
            lines.append(f"Your teacher noted: \"{remark}\". ")
        lines.append("Your hard work is paying off. Keep the momentum going with more challenging material. ")
        lines.append("Consider helping classmates who struggle with this subject — explaining concepts to others will deepen your own mastery. ")
        lines.append("If you maintain this trajectory, you will be ready for advanced-level work soon.")
    else:
        # Default: use the original strong advice
        return _strong_advice(subject, score, remark)

    return "".join(lines)


def _find_trend(subject_name, trends):
    """Find trend data for a specific subject."""
    for t in trends:
        if t.get("subject", "").lower() == subject_name.lower():
            return t
    return None


# ══════════════════════════════════════════════════════════════════════════════
# MASTER FUNCTION — called by FastAPI's /upload endpoint
# ══════════════════════════════════════════════════════════════════════════════
def run_pipeline(file_path: str, history: list = None, cached_result: dict = None) -> dict:
    """
    Master pipeline. Called by FastAPI's /upload endpoint.

    NEW: If `history` is provided (list of past term results from the database),
    the trend engine compares current vs past to detect trends, adjust
    predictions, and generate tiered recommendations.

    If `cached_result` is provided, skip the Gemini API call and reuse the
    existing extraction. This prevents burning API quota on duplicate calls.

    If history is None or empty, behaves exactly as before (single-term analysis).
    """
    from trend_engine import analyze_trends

    # ── Step 1-2: Extract data (skip if we already have a cached result) ──
    if cached_result is not None:
        print("[LOG] Pipeline re-run: reusing cached extraction (no Gemini call).")
        base_result = dict(cached_result)  # shallow copy
    else:
        print("[LOG] Pipeline started.")
        image           = load_report_image(file_path)
        data            = extract_report_data(image)
        print("[LOG] Calculating performance score...")
        perf_score      = calculate_performance_score(data)
        print("[LOG] Predicting performance...")
        prediction      = predict_performance(data, perf_score)

    # ── Step 3: Build the base result (only if no cache) ───────────────────
    if cached_result is None:
        subjects     = data.get("subjects", [])
        behavior_raw = data.get("behavior", {})
        attendance   = data.get("attendance", {}).get("interpreted", {})

        behavior_list = []
        for trait, values in behavior_raw.get("extracted_ratings", {}).items():
            behavior_list.append({
                "trait":     trait,
                "rating":    values.get("normalized_score", 0),
                "raw_value": values.get("raw_value", "")
            })

        base_result = {
            "student_name":         data.get("student", {}).get("name", "Student"),
            "student_class":        data.get("student", {}).get("class", ""),
            "term":                 data.get("student", {}).get("term", ""),
            "subjects": [
                {"name": s["name"], "score": s["score"],
                 "remark": s.get("teacher_remark") or s.get("grade") or "N/A"}
                for s in subjects
            ],
            "average_score":        data.get("average_score", 0),
            "weak_subjects":        data.get("weak_subjects", []),
            "strong_subjects":      data.get("strong_subjects", []),
            "performance_score":    perf_score["overall_score"],
            "academic_component":   perf_score["breakdown"]["academic_score"],
            "behaviour_component":  perf_score["breakdown"]["behaviour_score"],
            "attendance_component": perf_score["breakdown"]["attendance_score"],
            "behavior":             behavior_list,
            "attendance": {
                "present":    attendance.get("days_present", 0),
                "absent":     attendance.get("days_absent", 0),
                "total":      attendance.get("total_school_days", 0),
                "percentage": attendance.get("attendance_percentage", 0),
            },
            "prediction":   prediction["label"],
            "risk_score":   prediction["risk_score"],
            "risk_max":     prediction["risk_max"],
            "summary":      prediction["summary"],
            "warnings":     prediction["signals"]["academic_flags"],
            "strengths":    prediction["signals"]["positive_signals"],
        }

    # ── Step 4: Trend analysis (NEW) ─────────────────────────────────────
    trends = analyze_trends(base_result, history or [])

    # Adjust risk score based on historical trajectory
    adjustment = trends.get("prediction_adjustment", {})
    current_risk = base_result.get("risk_score", 0)
    adjusted_risk = current_risk + adjustment.get("risk_delta", 0)
    adjusted_risk = max(0, min(adjusted_risk, 20))

    if adjusted_risk != current_risk:
        if adjusted_risk >= 13:
            base_result["prediction"] = "Severely At Risk"
        elif adjusted_risk >= 8:
            base_result["prediction"] = "At Risk"
        elif adjusted_risk >= 4:
            base_result["prediction"] = "Needs Improvement"
        else:
            strong_count = len(base_result.get("strong_subjects", []))
            avg = base_result.get("average_score", 0)
            if strong_count >= 5 and avg >= 70:
                base_result["prediction"] = "High Performer"
            else:
                base_result["prediction"] = "On Track"
        base_result["risk_score"] = adjusted_risk

    # Add trend-based warnings and strengths
    for reason in adjustment.get("reasons", []):
        if any(w in reason.lower() for w in ["risk", "decline", "chronic", "dropping"]):
            base_result["warnings"].append(f"[Trend] {reason}")
        else:
            base_result["strengths"].append(f"[Trend] {reason}")

    # ── Step 5: Tiered recommendations (uses trend data) ────────────────
    subject_trends = trends.get("subject_trends", [])
    # For recommendations, build a minimal data dict from base_result
    rec_data = {
        "subjects": [{"name": s["name"], "score": s["score"], "teacher_remark": s.get("remark")} for s in base_result.get("subjects", [])],
        "weak_subjects": base_result.get("weak_subjects", []),
        "strong_subjects": base_result.get("strong_subjects", []),
        "average_score": base_result.get("average_score", 0),
        "student_class": base_result.get("student_class", ""),
    }
    rec_prediction = {
        "label": base_result.get("prediction", ""),
        "risk_score": base_result.get("risk_score", 0),
    }
    recommendations = generate_recommendations(rec_data, rec_prediction, subject_trends)
    base_result["recommendations"] = recommendations

    # ── Step 6: Attach trend data for the dashboard ──────────────────────
    base_result["trends"] = {
        "term_count":     trends["term_count"],
        "has_history":    trends["has_history"],
        "trajectory":     trends["trajectory"],
        "subject_trends": trends["subject_trends"],
        "patterns":       trends["patterns"],
        "trend_line":     trends["trend_line"],
    }

    return base_result