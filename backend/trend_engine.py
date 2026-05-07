# trend_engine.py
# ═══════════════════════════════════════════════════════════════════════════════
# Trend Engine — the NEW intelligence layer.
# Compares current term results against past terms to detect:
#   - Per-subject trends (improving, declining, stable, consistently strong/weak)
#   - Overall performance trajectory
#   - Trend-based prediction adjustments
#   - Tiered recommendation context
#
# This is where "the more past results, the more it can predict" lives.
# ═══════════════════════════════════════════════════════════════════════════════


def analyze_trends(current_result: dict, history: list) -> dict:
    """
    Master function. Takes the current term's analysis and a list of
    past term results (oldest first), and returns trend data.

    If history is empty (first upload), returns a minimal trend object.
    """
    if not history:
        return _first_term_response(current_result)

    current_subjects = {s["name"]: s["score"] for s in current_result.get("subjects", [])}
    term_count = len(history) + 1  # including current

    # ── Build per-subject history ────────────────────────────────────────
    subject_trends = _compute_subject_trends(current_subjects, history)

    # ── Build overall trajectory ─────────────────────────────────────────
    trajectory = _compute_overall_trajectory(current_result, history)

    # ── Identify patterns ────────────────────────────────────────────────
    patterns = _identify_patterns(subject_trends, trajectory, term_count)

    # ── Generate trend-based prediction adjustment ───────────────────────
    prediction_adjustment = _compute_prediction_adjustment(trajectory, patterns)

    # ── Build the real trend line data (for the dashboard chart) ─────────
    trend_line = _build_trend_line(current_result, history)

    return {
        "term_count":             term_count,
        "has_history":            True,
        "subject_trends":         subject_trends,
        "trajectory":             trajectory,
        "patterns":               patterns,
        "prediction_adjustment":  prediction_adjustment,
        "trend_line":             trend_line,
    }


def _first_term_response(current_result: dict) -> dict:
    """No history — return a baseline with no trends."""
    return {
        "term_count":             1,
        "has_history":            False,
        "subject_trends":         [],
        "trajectory":             {
            "direction": "baseline",
            "average_delta": 0,
            "performance_delta": 0,
            "description": "This is the first term on record. Upload more reports to unlock trend analysis and smarter predictions."
        },
        "patterns":               [],
        "prediction_adjustment":  {"risk_delta": 0, "reasons": []},
        "trend_line":             [
            {"term": current_result.get("term", "Current"), "score": current_result.get("average_score", 0)}
        ],
    }


# ══════════════════════════════════════════════════════════════════════════════
# PER-SUBJECT TRENDS
# ══════════════════════════════════════════════════════════════════════════════
def _compute_subject_trends(current_subjects: dict, history: list) -> list:
    """
    For each subject in the current term, compare against past terms.
    Returns a list of trend objects per subject.
    """
    trends = []

    for subject_name, current_score in current_subjects.items():
        # Collect this subject's scores across all past terms
        past_scores = []
        for term in history:
            for s in term.get("subjects", []):
                if s["name"].lower() == subject_name.lower():
                    past_scores.append(s["score"])
                    break

        if not past_scores:
            # Subject is new — no history to compare
            trends.append({
                "subject":       subject_name,
                "current_score": current_score,
                "trend":         "new",
                "delta":         0,
                "past_scores":   [],
                "description":   f"First time {subject_name} appears. No trend data yet."
            })
            continue

        last_score = past_scores[-1]
        delta = current_score - last_score
        all_scores = past_scores + [current_score]

        # Determine trend direction
        if len(all_scores) >= 3:
            # With 3+ data points, look at the overall direction
            trend_dir = _multi_term_direction(all_scores)
        else:
            # With 2 data points, just compare
            if delta >= 10:
                trend_dir = "improving"
            elif delta >= 3:
                trend_dir = "slightly_improving"
            elif delta <= -10:
                trend_dir = "declining"
            elif delta <= -3:
                trend_dir = "slightly_declining"
            else:
                trend_dir = "stable"

        # Check for sustained excellence or sustained weakness
        if all(s >= 80 for s in all_scores):
            trend_dir = "consistently_excellent"
        elif all(s < 50 for s in all_scores):
            trend_dir = "consistently_weak"

        # Build description
        desc = _subject_trend_description(subject_name, current_score, last_score,
                                           delta, trend_dir, len(all_scores))

        trends.append({
            "subject":       subject_name,
            "current_score": current_score,
            "previous_score": last_score,
            "delta":         delta,
            "trend":         trend_dir,
            "all_scores":    all_scores,
            "terms_tracked": len(all_scores),
            "description":   desc,
        })

    return trends


def _multi_term_direction(scores: list) -> str:
    """
    Given 3+ sequential scores, determine the overall trend direction.
    Uses simple linear slope estimation.
    """
    n = len(scores)
    # Simple least-squares slope
    x_mean = (n - 1) / 2
    y_mean = sum(scores) / n
    numerator = sum((i - x_mean) * (s - y_mean) for i, s in enumerate(scores))
    denominator = sum((i - x_mean) ** 2 for i in range(n))

    if denominator == 0:
        return "stable"

    slope = numerator / denominator

    if slope >= 5:
        return "improving"
    elif slope >= 2:
        return "slightly_improving"
    elif slope <= -5:
        return "declining"
    elif slope <= -2:
        return "slightly_declining"
    else:
        return "stable"


def _subject_trend_description(name, current, previous, delta, trend, terms):
    """Generate a human-readable trend description for a subject."""
    sign = "+" if delta > 0 else ""
    points = "point" if abs(delta) == 1 else "points"

    if trend == "consistently_excellent":
        return f"{name} has been excellent ({current}%) for {terms} consecutive terms. Consider advanced classes or peer tutoring."
    elif trend == "consistently_weak":
        return f"{name} has been below 50% for {terms} consecutive terms. Urgent, sustained intervention needed."
    elif trend == "improving":
        return f"{name} improved from {previous}% to {current}% ({sign}{delta} {points}). Strong upward trend over {terms} terms."
    elif trend == "slightly_improving":
        return f"{name} is showing gradual improvement: {previous}% → {current}% ({sign}{delta} {points})."
    elif trend == "declining":
        return f"{name} dropped from {previous}% to {current}% ({delta} {points}). This decline needs attention."
    elif trend == "slightly_declining":
        return f"{name} slipped slightly: {previous}% → {current}% ({delta} {points}). Monitor next term."
    elif trend == "stable":
        return f"{name} is stable at {current}% (was {previous}%). No significant change."
    else:
        return f"{name}: {current}%."


# ══════════════════════════════════════════════════════════════════════════════
# OVERALL TRAJECTORY
# ══════════════════════════════════════════════════════════════════════════════
def _compute_overall_trajectory(current_result: dict, history: list) -> dict:
    """
    Computes the student's overall performance trajectory across terms.
    """
    current_avg = current_result.get("average_score", 0)
    current_perf = current_result.get("performance_score", 0)

    past_avgs = [t.get("average_score", 0) for t in history]
    past_perfs = [t.get("performance_score", 0) for t in history]

    all_avgs = past_avgs + [current_avg]
    all_perfs = past_perfs + [current_perf]

    last_avg = past_avgs[-1] if past_avgs else current_avg
    last_perf = past_perfs[-1] if past_perfs else current_perf

    avg_delta = current_avg - last_avg
    perf_delta = current_perf - last_perf

    # Determine direction
    if len(all_avgs) >= 3:
        direction = _multi_term_direction(all_avgs)
    else:
        if avg_delta >= 5:
            direction = "improving"
        elif avg_delta <= -5:
            direction = "declining"
        else:
            direction = "stable"

    # Build description
    if direction == "improving":
        desc = f"Overall performance is trending upward. Average moved from {last_avg}% to {current_avg}% ({'+'}{avg_delta} points). The current study approach is working."
    elif direction == "declining":
        desc = f"Overall performance is declining. Average dropped from {last_avg}% to {current_avg}% ({avg_delta} points). Intervention is needed to reverse this trend."
    elif direction in ("slightly_improving", "slightly_declining"):
        word = "slightly improving" if "improving" in direction else "slightly declining"
        desc = f"Overall performance is {word}. Average went from {last_avg}% to {current_avg}% ({'+' if avg_delta > 0 else ''}{avg_delta} points)."
    else:
        desc = f"Overall performance is stable at {current_avg}% (was {last_avg}% last term)."

    return {
        "direction":         direction,
        "average_delta":     avg_delta,
        "performance_delta": perf_delta,
        "current_average":   current_avg,
        "previous_average":  last_avg,
        "all_averages":      all_avgs,
        "all_performance":   all_perfs,
        "description":       desc,
    }


# ══════════════════════════════════════════════════════════════════════════════
# PATTERN IDENTIFICATION
# ══════════════════════════════════════════════════════════════════════════════
def _identify_patterns(subject_trends: list, trajectory: dict, term_count: int) -> list:
    """
    Identify notable patterns from the trend data.
    These become extra warning signs or strengths in the prediction.
    """
    patterns = []

    # Count subjects by trend direction
    improving = [t for t in subject_trends if t["trend"] in ("improving", "slightly_improving")]
    declining = [t for t in subject_trends if t["trend"] in ("declining", "slightly_declining")]
    consistently_excellent = [t for t in subject_trends if t["trend"] == "consistently_excellent"]
    consistently_weak = [t for t in subject_trends if t["trend"] == "consistently_weak"]

    if len(consistently_excellent) >= 3:
        patterns.append({
            "type":    "strength",
            "pattern": "sustained_excellence",
            "message": f"Consistently excellent in {len(consistently_excellent)} subjects over {term_count} terms: {', '.join(t['subject'] for t in consistently_excellent)}. Ready for advanced-level work and peer tutoring."
        })

    if len(consistently_weak) >= 2:
        patterns.append({
            "type":    "warning",
            "pattern": "chronic_weakness",
            "message": f"Persistently struggling in {len(consistently_weak)} subjects for {term_count} terms: {', '.join(t['subject'] for t in consistently_weak)}. Foundational intervention required — current approach is not working."
        })

    if len(declining) >= 3:
        patterns.append({
            "type":    "warning",
            "pattern": "widespread_decline",
            "message": f"Declining in {len(declining)} subjects simultaneously. This may indicate broader issues beyond academics (attendance, motivation, personal circumstances)."
        })

    if len(improving) >= 3:
        patterns.append({
            "type":    "strength",
            "pattern": "widespread_improvement",
            "message": f"Improving in {len(improving)} subjects. Current study approach is clearly effective — maintain it."
        })

    # Attendance trend
    if term_count >= 2:
        att_pcts = []
        for t in subject_trends:
            pass  # attendance is in trajectory, not subject_trends

    # Check for a subject that flipped from strong to weak
    for t in subject_trends:
        if t.get("trend") == "declining" and t.get("delta", 0) <= -20:
            patterns.append({
                "type":    "warning",
                "pattern": "sharp_drop",
                "message": f"Sharp decline in {t['subject']}: dropped {abs(t['delta'])} points to {t['current_score']}%. Immediate attention needed."
            })

    # Check for a subject that flipped from weak to strong
    for t in subject_trends:
        if t.get("trend") == "improving" and t.get("delta", 0) >= 20:
            patterns.append({
                "type":    "strength",
                "pattern": "major_recovery",
                "message": f"Major improvement in {t['subject']}: gained {t['delta']} points to {t['current_score']}%. Whatever changed is working."
            })

    return patterns


# ══════════════════════════════════════════════════════════════════════════════
# PREDICTION ADJUSTMENT
# ══════════════════════════════════════════════════════════════════════════════
def _compute_prediction_adjustment(trajectory: dict, patterns: list) -> dict:
    """
    Compute how the historical trends should adjust the base risk score.
    Returns a delta (+/- points) and reasons.
    """
    risk_delta = 0
    reasons = []

    direction = trajectory.get("direction", "stable")

    # Trajectory-based adjustment
    if direction == "declining":
        risk_delta += 2
        reasons.append(f"Overall declining trend (average dropped {abs(trajectory['average_delta'])} points) — increased risk.")
    elif direction == "slightly_declining":
        risk_delta += 1
        reasons.append("Slight downward trend detected across terms.")
    elif direction == "improving":
        risk_delta -= 2
        reasons.append(f"Strong upward trend (average improved {trajectory['average_delta']} points) — reduced risk.")
    elif direction == "slightly_improving":
        risk_delta -= 1
        reasons.append("Gradual improvement trend detected — positive signal.")

    # Pattern-based adjustments
    for p in patterns:
        if p["pattern"] == "chronic_weakness":
            risk_delta += 2
            reasons.append("Chronic weakness detected — same subjects failing for multiple terms.")
        elif p["pattern"] == "widespread_decline":
            risk_delta += 1
            reasons.append("Multiple subjects declining simultaneously.")
        elif p["pattern"] == "sustained_excellence":
            risk_delta -= 1
            reasons.append("Sustained excellence across multiple subjects.")
        elif p["pattern"] == "widespread_improvement":
            risk_delta -= 1
            reasons.append("Widespread improvement trend across subjects.")

    return {
        "risk_delta": risk_delta,
        "reasons":    reasons,
    }


# ══════════════════════════════════════════════════════════════════════════════
# TREND LINE DATA (for the dashboard chart)
# ══════════════════════════════════════════════════════════════════════════════
def _build_trend_line(current_result: dict, history: list) -> list:
    """
    Build the data points for the dashboard's line chart.
    Each point has a term label and the average score.
    This replaces the fake "estimated previous" from the old dashboard.
    """
    points = []
    for term_data in history:
        points.append({
            "term":              term_data.get("term", "Past"),
            "score":             term_data.get("average_score", 0),
            "performance_score": term_data.get("performance_score", 0),
        })

    points.append({
        "term":              current_result.get("term", "Current"),
        "score":             current_result.get("average_score", 0),
        "performance_score": current_result.get("performance_score", 0),
    })

    return points


# ══════════════════════════════════════════════════════════════════════════════
# TIERED RECOMMENDATION CONTEXT
# ══════════════════════════════════════════════════════════════════════════════
def get_recommendation_tier(subject_name: str, current_score: int, subject_trends: list) -> str:
    """
    Determine the recommendation tier for a subject based on its
    current score AND historical trend.

    Returns one of:
        "exceptional"           — 80%+ for 2+ terms → advanced classes, tutoring
        "strong_and_improving"  — 60%+ and trending up → keep momentum
        "strong_stable"         — 60%+ and stable → standard enrichment
        "improving"             — was weak, now better → encourage
        "newly_struggling"      — was strong, now dropped → targeted help
        "persistently_weak"     — below 50 for 2+ terms → foundational intervention
        "weak"                  — below 50, first time → standard improvement
        "moderate"              — 50-59, no strong trend → general advice
    """
    # Find this subject's trend data
    trend_data = None
    for t in subject_trends:
        if t["subject"].lower() == subject_name.lower():
            trend_data = t
            break

    if not trend_data or trend_data["trend"] == "new":
        # No history — use score alone
        if current_score >= 80:
            return "strong_stable"
        elif current_score >= 60:
            return "strong_stable"
        elif current_score >= 50:
            return "moderate"
        else:
            return "weak"

    trend = trend_data["trend"]
    terms = trend_data.get("terms_tracked", 1)

    # Exceptional: consistently 80%+ across multiple terms
    if trend == "consistently_excellent":
        return "exceptional"

    # Persistently weak: below 50 for multiple terms
    if trend == "consistently_weak":
        return "persistently_weak"

    # Strong and improving
    if current_score >= 60 and trend in ("improving", "slightly_improving"):
        return "strong_and_improving"

    # Was weak, now improving
    if trend in ("improving", "slightly_improving") and current_score < 60:
        return "improving"

    # Newly struggling: was decent, now dropped
    if trend in ("declining", "slightly_declining") and current_score < 50:
        return "newly_struggling"

    # Declining but still passing
    if trend in ("declining", "slightly_declining") and current_score >= 50:
        return "moderate"

    # Default tiers by score
    if current_score >= 80:
        return "strong_stable"
    elif current_score >= 60:
        return "strong_stable"
    elif current_score >= 50:
        return "moderate"
    else:
        return "weak"
    
    