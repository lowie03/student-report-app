import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, LineChart, Line,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Cell,
} from "recharts";

// ─── Data ─────────────────────────────────────────────────────────────────────
const student = {
  name: "Ahmed",
  class: "N1",
  term: "Current Term",
  school: "Greenfield Academy",
  subjects: [
    { name: "Religious Studies",       score: 96 },
    { name: "Social Habit",            score: 71 },
    { name: "Health Habit",            score: 68 },
    { name: "Cultural & Creative Arts",score: 65 },
    { name: "Literacy",                score: 62 },
    { name: "Hand Writing",            score: 62 },
    { name: "Sciences",                score: 61 },
    { name: "Phonics & Spellings",     score: 57 },
    { name: "Numeracy",                score: 56 },
    { name: "Food & Nutrition",        score: 53 },
    { name: "Rhymes",                  score: 44 },
  ],
  averageScore:        63,
  performanceScore:    68,
  academicComponent:   63,
  behaviourComponent:  92,
  attendanceComponent: 88,
  prediction: "Needs Improvement",
  riskScore: 4,
  attendance: { present: 100, absent: 14, total: 114, percentage: 87.7 },
  behavior: [
    { trait: "Happy at School",        rating: 5 },
    { trait: "Behaves Well in Class",  rating: 4 },
    { trait: "Mixes Well with Others", rating: 5 },
    { trait: "Sensitive to Feelings",  rating: 5 },
    { trait: "Playground Behavior",    rating: 5 },
    { trait: "Manages Feelings",       rating: 5 },
    { trait: "Interest in Learning",   rating: 4 },
    { trait: "Listens Attentively",    rating: 4 },
    { trait: "Works Independently",    rating: 5 },
    { trait: "Works with Others",      rating: 4 },
  ],
  weakSubjects: ["Rhymes"],
  recommendations: [
    { type: "improve", subject: "Rhymes",           score: 44, remark: "Weak",        advice: "Requires immediate attention. Revisit class material consistently, seek additional teacher guidance, and supplement with structured audio-based practice at home." },
    { type: "improve", subject: "Food & Nutrition",  score: 53, remark: "Average",     advice: "Develop reference cards for core nutrition concepts and connect learning to real-world meal contexts to reinforce retention." },
    { type: "improve", subject: "Numeracy",          score: 56, remark: "Average",     advice: "Build number confidence through structured daily practice — applied arithmetic, counting activities, and problem-solving tasks." },
    { type: "enrich",  subject: "Religious Studies", score: 96, remark: "Distinction", advice: "Exceptional performance. Peer-assisted learning is recommended — teaching consolidates mastery and builds communication skills." },
    { type: "enrich",  subject: "Social Habit",      score: 71, remark: "Good",        advice: "Strong interpersonal skills. Extend by linking concepts to community contexts and structured group activities." },
  ],
  resources: [
    { subject: "Rhymes", score: 44, videos: [
      { title: "Nursery Rhymes — Structured Learning Collection", url: "https://youtube.com/results?search_query=nursery+rhymes+for+kids+learning" },
      { title: "Rhyming Words for Early Readers",                 url: "https://youtube.com/results?search_query=rhyming+words+for+kids" },
      { title: "Phonics & Rhymes — Guided Practice",              url: "https://youtube.com/results?search_query=phonics+rhymes+songs+kids" },
    ]},
    { subject: "Numeracy", score: 56, videos: [
      { title: "Counting & Number Foundations",       url: "https://youtube.com/results?search_query=counting+games+for+kids+learning" },
      { title: "Early Mathematics — Core Concepts",   url: "https://youtube.com/results?search_query=basic+math+for+early+learners" },
    ]},
    { subject: "Food & Nutrition", score: 53, videos: [
      { title: "Balanced Diet — A Children's Guide",  url: "https://youtube.com/results?search_query=healthy+eating+for+kids+learning" },
      { title: "Food Groups Explained",               url: "https://youtube.com/results?search_query=food+groups+for+kids" },
    ]},
  ],
};

// ─── Design System ────────────────────────────────────────────────────────────
// Strict monochrome dark + three semantic data colors only.
// No colored backgrounds. No gradients. Color is reserved for data meaning.
const C = {
  // Surfaces
  bg:     "#0C0C0C",
  s1:     "#141414",   // card / panel
  s2:     "#1A1A1A",   // elevated row / header
  s3:     "#202020",   // hover
  // Borders
  b1:     "#2A2A2A",   // default border
  b2:     "#1F1F1F",   // subtle row divider
  // Typography
  t1:     "#F5F5F5",   // primary
  t2:     "#A3A3A3",   // secondary
  t3:     "#525252",   // muted / label
  // Interactive (used ONLY for nav active state & links)
  blue:   "#3B82F6",
  // Semantic data colors (scores, risk, flags — nowhere else)
  green:  "#4ADE80",
  amber:  "#FBBF24",
  red:    "#F87171",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function scoreGrade(s) {
  if (s >= 80) return { label: "Distinction", color: C.green };
  if (s >= 65) return { label: "Good",        color: C.blue  };
  if (s >= 50) return { label: "Average",     color: C.amber };
  return              { label: "Weak",        color: C.red   };
}

function riskColor(r) {
  if (r <= 3) return C.green;
  if (r <= 6) return C.amber;
  return C.red;
}

const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

// ─── Navigation ───────────────────────────────────────────────────────────────
const NAV = [
  { id: "overview",    label: "Overview"    },
  { id: "subjects",    label: "Subjects"    },
  { id: "behaviour",   label: "Behaviour"   },
  { id: "predictions", label: "Predictions" },
  { id: "action-plan", label: "Action Plan" },
  { id: "resources",   label: "Resources"   },
];

// ─── Primitives ───────────────────────────────────────────────────────────────
function N({ v, style }) {
  // Numeric display — tabular figures
  return (
    <span style={{ fontVariantNumeric: "tabular-nums", fontFeatureSettings: "'tnum'", ...style }}>
      {v}
    </span>
  );
}

function Rule({ my = 0 }) {
  return <div style={{ height: 1, background: C.b1, margin: `${my}px 0` }} />;
}

function Track({ value, color = C.blue }) {
  return (
    <div style={{ height: 3, background: C.b1, borderRadius: 99 }}>
      <div style={{ height: "100%", width: `${Math.min(value, 100)}%`, background: color, borderRadius: 99, transition: "width 0.8s ease" }} />
    </div>
  );
}

function Chip({ label, color }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, letterSpacing: 0.7,
      textTransform: "uppercase",
      color,
      border: `1px solid ${color}`,
      borderRadius: 3,
      padding: "1px 7px",
      display: "inline-block",
    }}>
      {label}
    </span>
  );
}

function ColHead({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.9, textTransform: "uppercase", color: C.t3 }}>
      {children}
    </div>
  );
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.s2, border: `1px solid ${C.b1}`, borderRadius: 5, padding: "8px 12px", fontSize: 12 }}>
      <div style={{ color: C.t2, marginBottom: 2 }}>{label || payload[0]?.payload?.trait}</div>
      <div style={{ color: C.t1, fontWeight: 600 }}>
        {payload[0].value}{payload[0].value <= 5 ? "/5" : "%"}
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [active, setActive] = useState("overview");
  const [printing, setPrinting] = useState(false);

  const rc = riskColor(student.riskScore);

  const trendData = [
    { term: "Previous",  score: Math.round(student.averageScore * 0.91) },
    { term: "Current",   score: student.averageScore },
    { term: "Projected", score: Math.round(student.averageScore * (student.riskScore <= 3 ? 1.07 : student.riskScore <= 6 ? 1.02 : 0.95)) },
  ];

  const radarData = student.behavior.map(b => ({
    trait:     b.trait.length > 17 ? b.trait.slice(0, 15) + "…" : b.trait,
    fullTrait: b.trait,
    value:     b.rating,
  }));

  const distBands = [
    { label: "Distinction  80+", min: 80, color: C.green },
    { label: "Good  65–79",      min: 65, color: C.blue  },
    { label: "Average  50–64",   min: 50, color: C.amber },
    { label: "Weak  <50",        min: 0,  color: C.red   },
  ].map(b => ({ ...b, count: student.subjects.filter(s => s.score >= b.min && s.score < (b.min === 80 ? 101 : b.min + (b.min === 65 ? 15 : b.min === 50 ? 15 : 50))).length }))
   .filter(d => d.count > 0);

  const print = () => {
    setPrinting(true);
    setTimeout(() => { window.print(); setPrinting(false); }, 300);
  };

  const show = id => printing || active === id;

  // Shared panel style
  const panel = {
    background: C.s1,
    border: `1px solid ${C.b1}`,
    borderRadius: 8,
    overflow: "hidden",
  };

  const panelHead = {
    padding: "14px 20px",
    background: C.s2,
    borderBottom: `1px solid ${C.b1}`,
  };

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Inter','Segoe UI',system-ui,sans-serif", background: C.bg, color: C.t1, fontSize: 14 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.bg}; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: ${C.b1}; }
        a { text-decoration: none; color: inherit; }
        @media print {
          aside, .no-print { display: none !important; }
          main { padding: 24px !important; overflow: visible !important; }
          .section { display: block !important; margin-bottom: 36px; page-break-inside: avoid; }
          body { background: #fff; color: #111; }
        }
      `}</style>

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside style={{
        width: 220, flexShrink: 0,
        background: C.s1,
        borderRight: `1px solid ${C.b1}`,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* School */}
        <div style={{ padding: "22px 20px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.t3, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 1 }}>
            {student.school}
          </div>
          <div style={{ fontSize: 11, color: C.t3 }}>{student.term}</div>
        </div>

        <Rule />

        {/* Student */}
        <div style={{ padding: "18px 20px" }}>
          {/* Initial */}
          <div style={{
            width: 36, height: 36, borderRadius: 6,
            border: `1px solid ${C.b1}`,
            background: C.s2,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontWeight: 700, color: C.t1,
            marginBottom: 12,
          }}>
            {student.name[0]}
          </div>

          <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>{student.name}</div>
          <div style={{ fontSize: 12, color: C.t3, marginTop: 1, marginBottom: 16 }}>Class {student.class}</div>

          {/* Stats */}
          {[
            ["Avg. Score",  `${student.averageScore}%`,                null],
            ["Attendance",  `${student.attendance.percentage}%`,       student.attendance.percentage < 90 ? C.amber : C.green],
            ["Risk Level",  `${student.riskScore} / 10`,               rc],
            ["Prediction",  student.prediction,                        rc],
          ].map(([k, v, c]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 9 }}>
              <span style={{ fontSize: 11, color: C.t3 }}>{k}</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: c ?? C.t2 }}>{v}</span>
            </div>
          ))}
        </div>

        <Rule />

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px 12px", overflowY: "auto" }}>
          {NAV.map(item => {
            const on = active === item.id;
            return (
              <button key={item.id} onClick={() => setActive(item.id)}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "7px 10px", borderRadius: 5,
                  border: "none", background: on ? C.s3 : "transparent",
                  fontSize: 13, fontWeight: on ? 500 : 400,
                  color: on ? C.t1 : C.t3,
                  cursor: "pointer", transition: "all 0.12s",
                  marginBottom: 1,
                }}
                onMouseEnter={e => { if (!on) { e.currentTarget.style.color = C.t2; e.currentTarget.style.background = C.s2; }}}
                onMouseLeave={e => { if (!on) { e.currentTarget.style.color = C.t3; e.currentTarget.style.background = "transparent"; }}}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <Rule />

        {/* Export */}
        <div style={{ padding: "14px 12px" }}>
          <button onClick={print}
            style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%",
              padding: "8px 12px", borderRadius: 5,
              border: `1px solid ${C.b1}`, background: "transparent",
              color: C.t3, fontSize: 12, cursor: "pointer", transition: "all 0.12s",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = C.t1; e.currentTarget.style.borderColor = C.t3; }}
            onMouseLeave={e => { e.currentTarget.style.color = C.t3; e.currentTarget.style.borderColor = C.b1; }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export Report
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflowY: "auto", padding: "36px 40px 60px" }}>

        {/* Page title */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: C.t3, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 5 }}>
            {NAV.find(n => n.id === active)?.label}
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: C.t1, letterSpacing: -0.3, marginBottom: 3 }}>
            Student Performance Report
          </h1>
          <p style={{ fontSize: 12, color: C.t3 }}>
            {student.name} &nbsp;·&nbsp; Class {student.class} &nbsp;·&nbsp; {student.term}
          </p>
        </div>

        {/* ══ OVERVIEW ═══════════════════════════════════════════════ */}
        {show("overview") && (
          <div className="section" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Stat tiles — no colored backgrounds, only the number carries color */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: C.b1, border: `1px solid ${C.b1}`, borderRadius: 8, overflow: "hidden" }}>
              {[
                { label: "Performance",  value: student.performanceScore,    sub: "Weighted composite", color: C.t1   },
                { label: "Academic",     value: student.academicComponent,   sub: "60% of score",       color: scoreGrade(student.academicComponent).color },
                { label: "Behaviour",    value: student.behaviourComponent,  sub: "25% of score",       color: C.green },
                { label: "Attendance",   value: student.attendanceComponent, sub: "15% of score",       color: student.attendanceComponent >= 90 ? C.green : C.amber },
              ].map((s, i) => (
                <div key={i} style={{ background: C.s1, padding: "22px 22px 18px" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", color: C.t3, marginBottom: 14 }}>
                    {s.label}
                  </div>
                  <N v={s.value} style={{ fontSize: 38, fontWeight: 700, color: s.color, display: "block", lineHeight: 1, marginBottom: 12, letterSpacing: -1 }} />
                  <Track value={s.value} color={s.color} />
                  <div style={{ fontSize: 11, color: C.t3, marginTop: 8 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 16 }}>

              {/* Horizontal subject chart */}
              <div style={{ ...panel }}>
                <div style={{ ...panelHead }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.t1 }}>Subject Performance</div>
                  <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>All {student.subjects.length} subjects</div>
                </div>
                <div style={{ padding: "16px 8px 8px" }}>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={student.subjects} layout="vertical"
                      margin={{ top: 0, right: 20, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke={C.b2} horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tick={{ fill: C.t3, fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" width={155} tick={{ fill: C.t2, fontSize: 11 }} tickLine={false} axisLine={false} />
                      <ReTooltip content={<ChartTip />} cursor={{ fill: C.s3 }} />
                      <Bar dataKey="score" name="Score" radius={[0, 2, 2, 0]} barSize={10}>
                        {student.subjects.map((s, i) => (
                          <Cell key={i} fill={scoreGrade(s.score).color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Grade bands + summary */}
              <div style={{ ...panel }}>
                <div style={{ ...panelHead }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.t1 }}>Grade Distribution</div>
                  <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>{student.subjects.length} subjects</div>
                </div>
                <div style={{ padding: "20px" }}>
                  {distBands.map((d, i) => (
                    <div key={i} style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 11, color: C.t2 }}>{d.label}</span>
                        <N v={d.count} style={{ fontSize: 11, fontWeight: 600, color: d.color }} />
                      </div>
                      <Track value={(d.count / student.subjects.length) * 100} color={d.color} />
                    </div>
                  ))}

                  <Rule my={18} />

                  {[
                    ["Average",  `${student.averageScore}%`,                                          C.t2 ],
                    ["Highest",  `${Math.max(...student.subjects.map(s => s.score))}%`,               C.green],
                    ["Lowest",   `${Math.min(...student.subjects.map(s => s.score))}%`,               C.red ],
                    ["Range",    `${Math.max(...student.subjects.map(s => s.score)) - Math.min(...student.subjects.map(s => s.score))} pts`, C.amber],
                  ].map(([k, v, c]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 9 }}>
                      <span style={{ fontSize: 11, color: C.t3 }}>{k}</span>
                      <N v={v} style={{ fontSize: 13, fontWeight: 600, color: c }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Assessment strip */}
            <div style={{ ...panel }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 32, padding: "20px 24px", alignItems: "start" }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", color: C.t3, marginBottom: 8 }}>
                    Assessment
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: rc, marginBottom: 8 }}>{student.prediction}</div>
                  <p style={{ fontSize: 13, color: C.t2, lineHeight: 1.75, maxWidth: 560 }}>
                    The student demonstrates baseline competency but has identifiable gaps.
                    Early intervention in weak subjects will prevent further decline and support steady progress next term.
                  </p>
                </div>
                <div style={{ minWidth: 180 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", color: C.t3, marginBottom: 10 }}>
                    Risk Score
                  </div>
                  <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                    {Array.from({ length: 10 }, (_, i) => (
                      <div key={i} style={{ width: 14, height: 4, borderRadius: 99, background: i < student.riskScore ? rc : C.b1 }} />
                    ))}
                    <N v={`${student.riskScore}/10`} style={{ fontSize: 11, color: rc, marginLeft: 8 }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ SUBJECTS ═══════════════════════════════════════════════ */}
        {show("subjects") && (
          <div className="section" style={{ ...panel }}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 72px 160px 100px", padding: "12px 20px", background: C.s2, borderBottom: `1px solid ${C.b1}` }}>
              <ColHead>Subject</ColHead>
              <ColHead>Score</ColHead>
              <ColHead>Progress</ColHead>
              <ColHead>Grade</ColHead>
            </div>

            {/* Rows */}
            {student.subjects.map((s, i) => {
              const g = scoreGrade(s.score);
              return (
                <div key={i}
                  style={{ display: "grid", gridTemplateColumns: "1fr 72px 160px 100px", alignItems: "center", padding: "12px 20px", borderBottom: i < student.subjects.length - 1 ? `1px solid ${C.b2}` : "none", transition: "background 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.background = C.s3}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, color: C.t1 }}>{s.name}</span>
                    {student.weakSubjects.includes(s.name) && <Chip label="Priority" color={C.red} />}
                  </div>
                  <N v={s.score} style={{ fontSize: 14, fontWeight: 700, color: g.color }} />
                  <Track value={s.score} color={g.color} />
                  <Chip label={g.label} color={g.color} />
                </div>
              );
            })}

            {/* Footer */}
            <div style={{ display: "flex", gap: 36, flexWrap: "wrap", padding: "14px 20px", background: C.s2, borderTop: `1px solid ${C.b1}` }}>
              {[
                ["Average", `${student.averageScore}%`, C.t2  ],
                ["Highest", `${Math.max(...student.subjects.map(s => s.score))}%`, C.green],
                ["Lowest",  `${Math.min(...student.subjects.map(s => s.score))}%`, C.red  ],
                ["Range",   `${Math.max(...student.subjects.map(s => s.score)) - Math.min(...student.subjects.map(s => s.score))} pts`, C.amber],
              ].map(([k, v, c]) => (
                <div key={k}>
                  <div style={{ fontSize: 10, color: C.t3, letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 3 }}>{k}</div>
                  <N v={v} style={{ fontSize: 16, fontWeight: 700, color: c }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ BEHAVIOUR ══════════════════════════════════════════════ */}
        {show("behaviour") && (
          <div className="section" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

              {/* Conduct table */}
              <div style={{ ...panel }}>
                <div style={{ ...panelHead }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.t1 }}>Conduct Assessment</div>
                  <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>Teacher-rated, scale of 1–5</div>
                </div>
                {student.behavior.map((b, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "11px 20px",
                    borderBottom: i < student.behavior.length - 1 ? `1px solid ${C.b2}` : "none",
                  }}>
                    <span style={{ fontSize: 12, color: C.t2 }}>{b.trait}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ display: "flex", gap: 2 }}>
                        {Array.from({ length: 5 }, (_, j) => (
                          <div key={j} style={{ width: 6, height: 6, borderRadius: 99, background: j < b.rating ? C.green : C.b1 }} />
                        ))}
                      </div>
                      <N v={b.rating} style={{ fontSize: 11, color: C.t3, minWidth: 20, textAlign: "right" }} />
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", background: C.s2, borderTop: `1px solid ${C.b1}` }}>
                  <span style={{ fontSize: 11, color: C.t3 }}>Average</span>
                  <N v={`${avg(student.behavior.map(b => b.rating)).toFixed(1)} / 5`} style={{ fontSize: 14, fontWeight: 700, color: C.green }} />
                </div>
              </div>

              {/* Radar */}
              <div style={{ ...panel }}>
                <div style={{ ...panelHead }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.t1 }}>Trait Profile</div>
                  <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>All assessed conduct areas</div>
                </div>
                <div style={{ padding: "8px 8px 0" }}>
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke={C.b1} />
                      <PolarAngleAxis dataKey="trait" tick={{ fill: C.t3, fontSize: 9 }} />
                      <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
                      <Radar name="Rating" dataKey="value" stroke={C.blue} fill={C.blue} fillOpacity={0.1} strokeWidth={1.5} />
                      <ReTooltip content={<ChartTip />} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Attendance */}
            <div style={{ ...panel }}>
              <div style={{ ...panelHead }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.t1 }}>Attendance Record</div>
                <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>{student.term}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: C.b1 }}>
                {[
                  { label: "Days Present",     value: student.attendance.present,              color: C.green },
                  { label: "Days Absent",       value: student.attendance.absent,               color: C.red   },
                  { label: "Total School Days", value: student.attendance.total,                color: C.t2    },
                  { label: "Attendance Rate",   value: `${student.attendance.percentage}%`,     color: student.attendance.percentage >= 90 ? C.green : C.amber },
                ].map((item, i) => (
                  <div key={i} style={{ background: C.s1, padding: "18px 20px" }}>
                    <N v={item.value} style={{ fontSize: 28, fontWeight: 700, color: item.color, display: "block", marginBottom: 4 }} />
                    <div style={{ fontSize: 11, color: C.t3 }}>{item.label}</div>
                  </div>
                ))}
              </div>
              {student.attendance.percentage < 90 && (
                <div style={{ padding: "11px 20px", borderTop: `1px solid ${C.b1}`, fontSize: 12, color: C.amber }}>
                  Attendance is below the 90% threshold. Consistent attendance correlates strongly with academic performance.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ PREDICTIONS ════════════════════════════════════════════ */}
        {show("predictions") && (
          <div className="section" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Verdict */}
              <div style={{ ...panel }}>
                <div style={{ ...panelHead }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.t1 }}>Predictive Outcome</div>
                </div>
                <div style={{ padding: "20px" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", color: C.t3, marginBottom: 6 }}>Prediction</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: rc, marginBottom: 20 }}>{student.prediction}</div>

                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", color: C.t3, marginBottom: 8 }}>Risk Score</div>
                  <div style={{ display: "flex", gap: 3, alignItems: "center", marginBottom: 24 }}>
                    {Array.from({ length: 10 }, (_, i) => (
                      <div key={i} style={{ width: 18, height: 5, borderRadius: 99, background: i < student.riskScore ? rc : C.b1 }} />
                    ))}
                    <N v={`${student.riskScore}/10`} style={{ fontSize: 11, color: rc, marginLeft: 8 }} />
                  </div>

                  <Rule my={0} />

                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", color: C.t3, margin: "16px 0 12px" }}>Score Components</div>
                  {[
                    { label: "Academic",   weight: "60%", value: student.academicComponent,   color: scoreGrade(student.academicComponent).color },
                    { label: "Behaviour",  weight: "25%", value: student.behaviourComponent,  color: C.green },
                    { label: "Attendance", weight: "15%", value: student.attendanceComponent, color: student.attendanceComponent >= 90 ? C.green : C.amber },
                  ].map(c => (
                    <div key={c.label} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 12, color: C.t2 }}>{c.label} <span style={{ color: C.t3 }}>({c.weight})</span></span>
                        <N v={`${c.value}%`} style={{ fontSize: 12, fontWeight: 600, color: c.color }} />
                      </div>
                      <Track value={c.value} color={c.color} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Trend line */}
              <div style={{ ...panel }}>
                <div style={{ ...panelHead }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.t1 }}>Performance Trajectory</div>
                  <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>Three-term projection</div>
                </div>
                <div style={{ padding: "16px 12px 8px" }}>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={trendData} margin={{ top: 8, right: 12, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke={C.b2} vertical={false} />
                      <XAxis dataKey="term" tick={{ fill: C.t3, fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis domain={[40, 100]} tick={{ fill: C.t3, fontSize: 10 }} tickLine={false} axisLine={false} />
                      <ReTooltip content={<ChartTip />} />
                      <Line type="monotone" dataKey="score" name="Score" stroke={C.blue} strokeWidth={2}
                        dot={{ r: 4, fill: C.blue, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <Rule my={0} />

                <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", color: C.t3, marginBottom: 2 }}>
                    Flags
                  </div>
                  {[
                    `Underperforming in: ${student.weakSubjects.join(", ")}`,
                    `Score range ${Math.min(...student.subjects.map(s => s.score))}–${Math.max(...student.subjects.map(s => s.score))} indicates inconsistency`,
                    `Attendance ${student.attendance.percentage}% is below the 90% threshold`,
                  ].map((w, i) => (
                    <div key={i} style={{ fontSize: 12, color: C.t2, paddingLeft: 10, borderLeft: `2px solid ${C.red}` }}>
                      {w}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Strengths */}
            <div style={{ ...panel }}>
              <div style={{ ...panelHead }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.t1 }}>Strengths</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: C.b1 }}>
                {[
                  [`${student.averageScore}%`, "Class average demonstrates baseline competency"],
                  [`${student.behavior.filter(b => b.rating >= 4).length}/${student.behavior.length}`, "Conduct traits rated 4 or above"],
                  [`${student.subjects.filter(s => s.score >= 65).length}`, "Subjects at Good or above"],
                ].map(([stat, desc], i) => (
                  <div key={i} style={{ background: C.s1, padding: "18px 20px" }}>
                    <N v={stat} style={{ fontSize: 26, fontWeight: 700, color: C.green, display: "block", marginBottom: 6 }} />
                    <div style={{ fontSize: 12, color: C.t3, lineHeight: 1.5 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ ACTION PLAN ════════════════════════════════════════════ */}
        {show("action-plan") && (
          <div className="section" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { heading: "Improvement Areas", sub: "Subjects requiring focused intervention this term", type: "improve", color: C.red   },
              { heading: "Enrichment",        sub: "Build on existing strengths",                       type: "enrich",  color: C.green },
            ].map(group => (
              <div key={group.type} style={{ ...panel }}>
                <div style={{ ...panelHead }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.t1 }}>{group.heading}</div>
                  <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>{group.sub}</div>
                </div>
                {student.recommendations.filter(r => r.type === group.type).map((r, i, arr) => (
                  <div key={i} style={{
                    display: "grid", gridTemplateColumns: "150px 1fr",
                    borderBottom: i < arr.length - 1 ? `1px solid ${C.b2}` : "none",
                  }}>
                    <div style={{ padding: "18px 16px 18px 20px", borderRight: `1px solid ${C.b2}` }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: C.t1, marginBottom: 8 }}>{r.subject}</div>
                      <N v={r.score} style={{ fontSize: 24, fontWeight: 700, color: group.color, display: "block", marginBottom: 8 }} />
                      <Chip label={r.remark} color={group.color} />
                    </div>
                    <div style={{ padding: "18px 20px", display: "flex", alignItems: "flex-start" }}>
                      <p style={{ fontSize: 13, color: C.t2, lineHeight: 1.8 }}>{r.advice}</p>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ══ RESOURCES ══════════════════════════════════════════════ */}
        {show("resources") && (
          <div className="section" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ ...panel }}>
              <div style={{ ...panelHead }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.t1 }}>Suggested Learning Resources</div>
                <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>Video links for identified weak areas</div>
              </div>

              {student.resources.map((res, ri) => (
                <div key={ri} style={{ borderBottom: ri < student.resources.length - 1 ? `1px solid ${C.b2}` : "none" }}>
                  {/* Subject row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px 10px", background: C.s2, borderBottom: `1px solid ${C.b2}` }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: C.t1 }}>{res.subject}</span>
                    <N v={`${res.score}%`} style={{ fontSize: 11, color: C.red }} />
                    <Chip label="Priority" color={C.red} />
                  </div>
                  {/* Video links */}
                  {res.videos.map((v, vi) => (
                    <a key={vi} href={v.url} target="_blank" rel="noopener noreferrer"
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 20px", borderBottom: vi < res.videos.length - 1 ? `1px solid ${C.b2}` : "none", transition: "background 0.1s" }}
                      onMouseEnter={e => e.currentTarget.style.background = C.s3}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <span style={{ fontSize: 13, color: C.t2 }}>{v.title}</span>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                    </a>
                  ))}
                </div>
              ))}
            </div>

            <div style={{ padding: "12px 16px", border: `1px solid ${C.b1}`, borderRadius: 6, fontSize: 12, color: C.t3, lineHeight: 1.7 }}>
              <strong style={{ color: C.t2 }}>Note:</strong> Links open YouTube search results for the topic.
              Direct video recommendations will be available once YouTube API integration is complete.
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
