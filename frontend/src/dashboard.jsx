import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

// ─── Color Palette ───
const C = {
  bg: "#06080F",
  card: "#0E1220",
  cardHover: "#141A2E",
  border: "#1C2340",
  accent: "#5B8DEF",
  accentDim: "rgba(91, 141, 239, 0.12)",
  success: "#3DD68C",
  successDim: "rgba(61, 214, 140, 0.12)",
  warning: "#F0B435",
  warningDim: "rgba(240, 180, 53, 0.12)",
  danger: "#EF5B5B",
  dangerDim: "rgba(239, 91, 91, 0.12)",
  text: "#E8ECF4",
  textSec: "#8494B2",
  textMuted: "#556380",
  purple: "#9B7BEF",
  purpleDim: "rgba(155, 123, 239, 0.12)",
};

const SCORE_COLORS = ["#5B8DEF", "#3DD68C", "#F0B435", "#EF5B5B", "#9B7BEF", "#EF8F5B", "#5BD6D6", "#7B7BEF", "#EF5BA0", "#C45BEF", "#8DEF5B"];

function scoreColor(s) {
  if (s >= 80) return C.success;
  if (s >= 60) return C.accent;
  if (s >= 50) return C.warning;
  return C.danger;
}

// ─── Small components ───

function AnimNum({ value, suffix = "" }) {
  const [d, setD] = useState(0);
  useEffect(() => {
    let n = 0;
    const step = value / 60;
    const t = setInterval(() => {
      n += step;
      if (n >= value) { setD(value); clearInterval(t); }
      else setD(Math.round(n * 10) / 10);
    }, 16);
    return () => clearInterval(t);
  }, [value]);
  return <span>{Math.round(d)}{suffix}</span>;
}

function Ring({ value, size = 110, stroke = 7, color, label, sub }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const [off, setOff] = useState(circ);
  useEffect(() => { setTimeout(() => setOff(circ - (value / 100) * circ), 80); }, [value, circ]);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)", display: "block" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)" }} />
        </svg>
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 22, fontWeight: 700, color }}><AnimNum value={value} /></span>
        </div>
      </div>
      <div style={{ textAlign: "center", marginTop: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function Card({ children, style, accent }) {
  return (
    <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 22, position: "relative", overflow: "hidden", ...style }}>
      {accent && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${accent}, transparent)` }} />}
      {children}
    </div>
  );
}

function Section({ icon, title, sub }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>{title}</h2>
      </div>
      {sub && <p style={{ fontSize: 12, color: C.textMuted, margin: "3px 0 0 26px" }}>{sub}</p>}
    </div>
  );
}

function Badge({ text, color, bg }) {
  return <span style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, color, background: bg, letterSpacing: 0.3 }}>{text}</span>;
}

function RiskBar({ score, max = 20 }) {
  const pct = Math.min(score / max, 1);
  const segments = 10;
  const filled = Math.round(pct * segments);
  const col = filled <= 3 ? C.success : filled <= 6 ? C.warning : C.danger;
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {Array.from({ length: segments }, (_, i) => (
        <div key={i} style={{ width: 18, height: 7, borderRadius: 4, background: i < filled ? col : C.border, transition: "background 0.3s" }} />
      ))}
      <span style={{ fontSize: 12, fontWeight: 600, color: C.textSec, marginLeft: 6 }}>{score}/{max}</span>
    </div>
  );
}

function Stars({ value, max = 5 }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} style={{ fontSize: 13, color: i < value ? "#F0B435" : C.border }}>★</span>
      ))}
    </div>
  );
}

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1A2038", border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: C.text }}>{label || payload[0]?.payload?.fullTrait || payload[0]?.name}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ margin: "3px 0 0", fontSize: 11, color: p.color || C.accent }}>{p.name}: {p.value}{typeof p.value === "number" && p.value <= 5 ? "/5" : "%"}</p>
      ))}
    </div>
  );
};

// ─── Tabs ───
const TABS = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "subjects", label: "Subjects", icon: "📚" },
  { id: "behavior", label: "Behavior", icon: "🌟" },
  { id: "predictions", label: "Predictions", icon: "🔮" },
  { id: "recommendations", label: "Plan", icon: "🎯" },
  { id: "resources", label: "Resources", icon: "▶️" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD — receives `data` from API via props
// ═══════════════════════════════════════════════════════════════════════════════
export default function Dashboard({ data, onReset }) {
  const [tab, setTab] = useState("overview");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setTimeout(() => setLoaded(true), 80); }, []);

  // ── Derived values from API response ─────────────────────────────────────
  const subjects = data.subjects || [];
  const sorted = [...subjects].sort((a, b) => b.score - a.score);
  const avg = data.average_score || 0;
  const perfScore = data.performance_score || 0;
  const acadComp = data.academic_component || 0;
  const behComp = data.behaviour_component || 0;
  const attComp = data.attendance_component || 0;
  const prediction = data.prediction || "N/A";
  const riskScore = data.risk_score || 0;
  const riskMax = data.risk_max || 20;
  const summary = data.summary || "";
  const warnings = data.warnings || [];
  const strengths = data.strengths || [];
  const attendance = data.attendance || {};
  const behavior = data.behavior || [];
  const weak = data.weak_subjects || [];
  const strong = data.strong_subjects || [];
  const recs = data.recommendations || [];
  const studentName = data.student_name || "Student";
  const studentClass = data.student_class || "";

  const perfDist = [
    { name: "Excellent (80+)", value: subjects.filter(s => s.score >= 80).length, color: C.success },
    { name: "Good (60-79)", value: subjects.filter(s => s.score >= 60 && s.score < 80).length, color: C.accent },
    { name: "Fair (50-59)", value: subjects.filter(s => s.score >= 50 && s.score < 60).length, color: C.warning },
    { name: "Weak (<50)", value: subjects.filter(s => s.score < 50).length, color: C.danger },
  ].filter(d => d.value > 0);

  const trendData = [
    { term: "Previous", score: Math.round(avg * 0.93) },
    { term: "Current", score: avg },
    { term: "Projected", score: Math.round(avg * (riskScore <= 5 ? 1.05 : riskScore <= 10 ? 1.01 : 0.95)) },
  ];

  const behaviorRadar = behavior.map(b => ({
    trait: b.trait.length > 14 ? b.trait.substring(0, 12) + "…" : b.trait,
    fullTrait: b.trait,
    value: b.rating,
    fullMark: 5,
  }));

  // Separate improvement vs enrichment recs
  const improvementRecs = recs.filter(r => r.type === "improvement");
  const enrichmentRecs = recs.filter(r => r.type === "enrichment");

  // Collect all YouTube videos from recs
  const youtubeResources = recs
    .filter(r => r.videos && r.videos.length > 0)
    .map(r => ({ subject: r.subject, score: r.score, type: r.type, videos: r.videos }));

  const allScores = subjects.map(s => s.score);
  const maxScore = allScores.length ? Math.max(...allScores) : 0;
  const minScore = allScores.length ? Math.min(...allScores) : 0;

  return (
    <div style={{
      fontFamily: "'Outfit', system-ui, sans-serif",
      background: C.bg,
      color: C.text,
      minHeight: "100vh",
      opacity: loaded ? 1 : 0,
      transition: "opacity 0.5s",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
        .tab-btn { cursor: pointer; border: none; outline: none; background: none; transition: all 0.2s; }
        .tab-btn:hover { background: ${C.accentDim} !important; }
        .subj-row { transition: background 0.15s; }
        .subj-row:hover { background: ${C.cardHover} !important; }
        .rec-card { transition: transform 0.2s, box-shadow 0.2s; }
        .rec-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.35); }
        .vid-link { transition: all 0.2s; text-decoration: none; }
        .vid-link:hover { background: ${C.accentDim} !important; }
        .reset-btn { cursor: pointer; border: 1px solid ${C.border}; border-radius: 10px; padding: 8px 16px;
          background: transparent; color: ${C.textSec}; font-size: 13px; font-weight: 500;
          font-family: inherit; transition: all 0.2s; }
        .reset-btn:hover { border-color: ${C.accent}; color: ${C.accent}; background: ${C.accentDim}; }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: "24px 24px 0", maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 14,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "linear-gradient(135deg, #5B8DEF, #9B7BEF)",
              fontSize: 20, fontWeight: 700, color: "#fff",
            }}>
              {studentName[0]}
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>
                Hello, {studentName}
              </h1>
              <p style={{ fontSize: 13, color: C.textSec, marginTop: 2 }}>
                Here is your academic performance analysis
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {studentClass && <Badge text={`Class: ${studentClass}`} color={C.accent} bg={C.accentDim} />}
            {attendance.percentage != null && (
              <Badge
                text={`Attendance: ${attendance.percentage}%`}
                color={attendance.percentage >= 90 ? C.success : C.warning}
                bg={attendance.percentage >= 90 ? C.successDim : C.warningDim}
              />
            )}
            <button className="reset-btn" onClick={onReset}>New Report</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 3, marginTop: 22, overflowX: "auto", paddingBottom: 2 }}>
          {TABS.map(t => (
            <button key={t.id} className="tab-btn" onClick={() => setTab(t.id)} style={{
              padding: "9px 14px", borderRadius: 10, display: "flex", alignItems: "center", gap: 5,
              fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? C.accent : C.textMuted,
              background: tab === t.id ? C.accentDim : "transparent",
              whiteSpace: "nowrap",
            }}>
              <span style={{ fontSize: 14 }}>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div style={{ padding: "18px 24px 40px", maxWidth: 1080, margin: "0 auto" }}>

        {/* ═══ OVERVIEW ═══ */}
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
              <Card accent={C.accent}><div style={{ textAlign: "center" }}><Ring value={perfScore} color={C.accent} label="Performance" sub="Weighted composite" /></div></Card>
              <Card accent={C.success}><div style={{ textAlign: "center" }}><Ring value={acadComp} color={scoreColor(acadComp)} label="Academic" sub="60% weight" /></div></Card>
              <Card accent={C.purple}><div style={{ textAlign: "center" }}><Ring value={behComp} color={C.purple} label="Behaviour" sub="25% weight" /></div></Card>
              <Card accent={C.warning}><div style={{ textAlign: "center" }}><Ring value={typeof attComp === "number" ? attComp : 0} color={C.warning} label="Attendance" sub="15% weight" /></div></Card>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Card>
                <Section icon="📊" title="Subject scores" />
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={sorted} margin={{ top: 5, right: 10, left: -10, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="name" tick={{ fill: C.textMuted, fontSize: 10 }} angle={-45} textAnchor="end" interval={0} />
                    <YAxis domain={[0, 100]} tick={{ fill: C.textMuted, fontSize: 11 }} />
                    <Tooltip content={<TT />} />
                    <Bar dataKey="score" name="Score" radius={[5, 5, 0, 0]} maxBarSize={34}>
                      {sorted.map((e, i) => <Cell key={i} fill={scoreColor(e.score)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card>
                <Section icon="🥧" title="Performance distribution" />
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={perfDist} cx="50%" cy="50%" innerRadius={55} outerRadius={95}
                      paddingAngle={4} dataKey="value" nameKey="name"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={{ stroke: C.textMuted }}>
                      {perfDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip content={<TT />} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <Card accent={riskScore <= 5 ? C.success : riskScore <= 10 ? C.warning : C.danger}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
                <div>
                  <Section icon="🔮" title="Prediction summary" />
                  <p style={{ fontSize: 15, fontWeight: 600, color: riskScore <= 5 ? C.success : riskScore <= 10 ? C.warning : C.danger }}>{prediction}</p>
                  <p style={{ fontSize: 13, color: C.textSec, marginTop: 4, maxWidth: 480 }}>{summary}</p>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 5, fontWeight: 600, letterSpacing: 0.5 }}>RISK LEVEL</div>
                  <RiskBar score={riskScore} max={riskMax} />
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ═══ SUBJECTS ═══ */}
        {tab === "subjects" && (
          <Card>
            <Section icon="📚" title="Subject-by-subject analysis" sub="Sorted by score, highest to lowest" />
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {sorted.map((s, i) => (
                <div key={i} className="subj-row" style={{
                  display: "grid", gridTemplateColumns: "2fr 70px 1fr 100px",
                  alignItems: "center", padding: "12px 14px", borderRadius: 10,
                  background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{s.name}</span>
                    {weak.includes(s.name) && (
                      <span style={{ marginLeft: 8, fontSize: 10, padding: "2px 8px", borderRadius: 10, background: C.dangerDim, color: C.danger, fontWeight: 600 }}>NEEDS WORK</span>
                    )}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: scoreColor(s.score) }}>{s.score}</div>
                  <div style={{ position: "relative", height: 7, background: C.border, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${s.score}%`, background: scoreColor(s.score), borderRadius: 4, transition: "width 0.8s ease-out" }} />
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <Badge text={s.remark || "N/A"} color={scoreColor(s.score)} bg={`${scoreColor(s.score)}1A`} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 18, padding: "12px 14px", borderRadius: 10, background: C.accentDim, border: `1px solid ${C.accent}30` }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div><span style={{ fontSize: 12, color: C.textSec }}>Average: </span><span style={{ fontSize: 15, fontWeight: 700, color: C.accent }}>{avg}%</span></div>
                <div><span style={{ fontSize: 12, color: C.textSec }}>Highest: </span><span style={{ fontSize: 15, fontWeight: 700, color: C.success }}>{maxScore}%</span></div>
                <div><span style={{ fontSize: 12, color: C.textSec }}>Lowest: </span><span style={{ fontSize: 15, fontWeight: 700, color: C.danger }}>{minScore}%</span></div>
                <div><span style={{ fontSize: 12, color: C.textSec }}>Range: </span><span style={{ fontSize: 15, fontWeight: 700, color: C.warning }}>{maxScore - minScore} pts</span></div>
              </div>
            </div>
          </Card>
        )}

        {/* ═══ BEHAVIOR ═══ */}
        {tab === "behavior" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Card>
              <Section icon="🌟" title="Behavioral profile" sub="Teacher-assessed conduct traits" />
              {behavior.length > 0 ? (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {behavior.map((b, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
                        <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{b.trait}</span>
                        <Stars value={b.rating} />
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: C.purpleDim }}>
                    <span style={{ fontSize: 12, color: C.textSec }}>Average behaviour: </span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: C.purple }}>
                      {(behavior.reduce((a, b) => a + b.rating, 0) / behavior.length).toFixed(1)}/5
                    </span>
                  </div>
                </>
              ) : (
                <p style={{ fontSize: 13, color: C.textMuted }}>No behavioral data found on this report card.</p>
              )}
            </Card>

            <Card>
              <Section icon="🕸️" title="Radar view" sub="Visual overview of all traits" />
              {behaviorRadar.length > 0 ? (
                <ResponsiveContainer width="100%" height={340}>
                  <RadarChart data={behaviorRadar}>
                    <PolarGrid stroke={C.border} />
                    <PolarAngleAxis dataKey="trait" tick={{ fill: C.textMuted, fontSize: 10 }} />
                    <PolarRadiusAxis domain={[0, 5]} tick={{ fill: C.textMuted, fontSize: 10 }} />
                    <Radar name="Rating" dataKey="value" stroke={C.purple} fill={C.purple} fillOpacity={0.2} />
                    <Tooltip content={<TT />} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 340, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <p style={{ fontSize: 13, color: C.textMuted }}>No data to display.</p>
                </div>
              )}
            </Card>

            <Card accent={C.warning} style={{ gridColumn: "1 / -1" }}>
              <Section icon="📅" title="Attendance record" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 14, marginTop: 6 }}>
                {[
                  { label: "Days present", value: attendance.present ?? "N/A", color: C.success },
                  { label: "Days absent", value: attendance.absent ?? "N/A", color: C.danger },
                  { label: "Total school days", value: attendance.total ?? "N/A", color: C.accent },
                  { label: "Attendance rate", value: attendance.percentage != null ? `${attendance.percentage}%` : "N/A", color: attendance.percentage >= 90 ? C.success : C.warning },
                ].map((it, i) => (
                  <div key={i} style={{ textAlign: "center", padding: 14, borderRadius: 12, background: `${it.color}0D` }}>
                    <div style={{ fontSize: 26, fontWeight: 700, color: it.color }}>{it.value}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>{it.label}</div>
                  </div>
                ))}
              </div>
              {attendance.percentage != null && attendance.percentage < 90 && (
                <div style={{ marginTop: 14, padding: "9px 14px", borderRadius: 8, background: C.warningDim, fontSize: 13, color: C.warning }}>
                  Attendance is below 90%. Consistent attendance is strongly linked to better academic outcomes.
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ═══ PREDICTIONS ═══ */}
        {tab === "predictions" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Card accent={riskScore <= 5 ? C.success : riskScore <= 10 ? C.warning : C.danger}>
              <Section icon="🔮" title="Predictive analysis" sub="Based on academic scores, behaviour, and attendance" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 6 }}>
                <div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 3 }}>PREDICTION</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: riskScore <= 5 ? C.success : riskScore <= 10 ? C.warning : C.danger }}>{prediction}</div>
                  <div style={{ marginTop: 14, fontSize: 12, color: C.textMuted }}>RISK SCORE</div>
                  <div style={{ marginTop: 5 }}><RiskBar score={riskScore} max={riskMax} /></div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>SCORE COMPONENTS</div>
                  {[
                    { label: "Academic (60%)", value: acadComp, color: scoreColor(acadComp) },
                    { label: "Behaviour (25%)", value: behComp, color: C.purple },
                    { label: "Attendance (15%)", value: typeof attComp === "number" ? attComp : 0, color: C.warning },
                  ].map((c, i) => (
                    <div key={i} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textSec, marginBottom: 3 }}>
                        <span>{c.label}</span><span style={{ color: c.color, fontWeight: 600 }}>{c.value}%</span>
                      </div>
                      <div style={{ height: 5, background: C.border, borderRadius: 3 }}>
                        <div style={{ height: "100%", width: `${c.value}%`, background: c.color, borderRadius: 3, transition: "width 0.8s" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Card>
                <Section icon="📈" title="Projected trend" />
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trendData} margin={{ top: 8, right: 16, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="term" tick={{ fill: C.textMuted, fontSize: 11 }} />
                    <YAxis domain={[Math.max(0, minScore - 20), 100]} tick={{ fill: C.textMuted, fontSize: 10 }} />
                    <Tooltip content={<TT />} />
                    <Line type="monotone" dataKey="score" name="Average" stroke={C.accent} strokeWidth={3} dot={{ r: 5, fill: C.accent }} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <Card>
                <Section icon="⚠️" title="Warning signs and strengths" />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
                  {warnings.map((w, i) => (
                    <div key={`w-${i}`} style={{ padding: "8px 12px", borderRadius: 8, fontSize: 12, background: C.dangerDim, color: C.danger, borderLeft: `3px solid ${C.danger}` }}>{w}</div>
                  ))}
                  {strengths.map((s, i) => (
                    <div key={`s-${i}`} style={{ padding: "8px 12px", borderRadius: 8, fontSize: 12, background: C.successDim, color: C.success, borderLeft: `3px solid ${C.success}` }}>{s}</div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ═══ RECOMMENDATIONS ═══ */}
        {tab === "recommendations" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {improvementRecs.length > 0 && (
              <Card accent={C.danger}>
                <Section icon="🚨" title="Improvement areas" sub="Subjects that need focused attention" />
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {improvementRecs.map((r, i) => (
                    <div key={i} className="rec-card" style={{ padding: 16, borderRadius: 12, background: C.dangerDim, border: `1px solid ${C.danger}30` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: C.danger }}>{r.subject}</span>
                        <Badge text={`${r.score}%${r.teacher_remark ? " — " + r.teacher_remark : ""}`} color={C.danger} bg={`${C.danger}1A`} />
                      </div>
                      <p style={{ fontSize: 13, color: C.textSec, lineHeight: 1.6 }}>{r.advice}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {enrichmentRecs.length > 0 && (
              <Card accent={C.success}>
                <Section icon="🌱" title="Enrichment opportunities" sub="Build on existing strengths" />
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {enrichmentRecs.map((r, i) => (
                    <div key={i} className="rec-card" style={{ padding: 16, borderRadius: 12, background: C.successDim, border: `1px solid ${C.success}30` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: C.success }}>{r.subject}</span>
                        <Badge text={`${r.score}%${r.teacher_remark ? " — " + r.teacher_remark : ""}`} color={C.success} bg={`${C.success}1A`} />
                      </div>
                      <p style={{ fontSize: 13, color: C.textSec, lineHeight: 1.6 }}>{r.advice}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ═══ RESOURCES ═══ */}
        {tab === "resources" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {youtubeResources.length > 0 ? (
              <Card accent={C.danger}>
                <Section icon="▶️" title="Suggested learning videos" sub="Real YouTube recommendations for each subject" />
                {youtubeResources.map((res, i) => (
                  <div key={i} style={{ marginBottom: i < youtubeResources.length - 1 ? 22 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: res.type === "improvement" ? C.danger : C.success }}>{res.subject}</span>
                      <Badge text={`${res.score}%`} color={res.type === "improvement" ? C.danger : C.success} bg={res.type === "improvement" ? C.dangerDim : C.successDim} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {res.videos.map((v, j) => (
                        <a key={j} href={v.url} target="_blank" rel="noopener noreferrer" className="vid-link"
                          style={{
                            display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                            borderRadius: 10, background: "rgba(255,255,255,0.02)",
                            border: `1px solid ${C.border}`, color: C.text,
                          }}>
                          {v.thumbnail ? (
                            <img src={v.thumbnail} alt="" style={{ width: 48, height: 36, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                          ) : (
                            <div style={{ width: 48, height: 36, borderRadius: 6, background: "#FF000018", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <span style={{ fontSize: 16 }}>▶</span>
                            </div>
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.title}</div>
                            <div style={{ fontSize: 11, color: C.textMuted }}>Watch on YouTube</div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </Card>
            ) : (
              <Card>
                <Section icon="▶️" title="Suggested learning videos" />
                <p style={{ fontSize: 13, color: C.textMuted }}>
                  No video recommendations available. This happens when the YouTube API key is not set in the backend .env file, or when no weak/strong subjects were detected.
                </p>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}