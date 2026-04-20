import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell,
  Tooltip, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PieChart, Pie, AreaChart, Area,
} from "recharts";

const S = {
  container: { display: "flex", minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" },
  sidebar: { 
    width: "280px", 
    borderRight: "1px solid var(--border)", 
    padding: "48px 0", 
    display: "flex", 
    flexDirection: "column",
    position: "fixed",
    top: 0,
    left: 0,
    height: "100vh",
    background: "var(--surface)",
    zIndex: 1000,
    boxShadow: "10px 0 30px -15px rgba(0,0,0,0.05)"
  },
  main: { flex: 1, marginLeft: "280px", padding: "64px 80px", minWidth: 0 },
  navItem: (active) => ({
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "14px 32px",
    fontSize: "14px",
    fontWeight: active ? 700 : 500,
    cursor: "pointer",
    background: active ? "var(--bg)" : "transparent",
    color: active ? "var(--fg)" : "var(--muted)",
    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
    border: "none",
    borderLeft: active ? "4px solid var(--fg)" : "4px solid transparent",
    width: "100%",
    justifyContent: "flex-start", // CRITICAL FIX FOR CENTERING
    textAlign: "left",
    outline: "none"
  }),
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "16px",
    padding: "32px",
    boxShadow: "0 4px 12px -2px rgba(0,0,0,0.02)",
    transition: "transform 0.3s ease",
  },
  sectionTitle: {
    fontSize: "12px",
    fontWeight: 800,
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.15em",
    marginBottom: "24px",
    display: "flex",
    alignItems: "center",
    gap: "8px"
  }
};

const ICONS = {
  overview: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>,
  academics: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>,
  behavior: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>,
  insights: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>,
  learning: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m16 6 4 14M12 6v14M8 8v12M4 4v16"></path></svg>,
};

export default function Dashboard({ data, onReset }) {
  const [activeTab, setActiveTab] = useState("overview");

  const subjects = data.subjects || [];
  const sorted = [...subjects].sort((a, b) => b.score - a.score);
  const prediction = data.prediction || "STATUS_UNKNOWN";
  const behavior = data.behavior || [];
  const attendance = data.attendance || {};
  const recs = data.recommendations || [];

  const pieData = [
    { name: "Achieved", value: data.average_score },
    { name: "Gap", value: 100 - data.average_score }
  ];

  const behaviorRadar = behavior.map(b => ({
    trait: b.trait.length > 10 ? b.trait.substring(0, 8) + ".." : b.trait,
    value: b.rating,
    full: 5
  }));

  const groupedResources = recs.reduce((acc, r) => {
    if (r.videos?.length > 0) {
      if (!acc[r.subject]) acc[r.subject] = [];
      acc[r.subject].push(...r.videos);
    }
    return acc;
  }, {});

  const renderContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <div className="animate-in" style={{ display: "grid", gap: "40px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "24px" }}>
              {[
                { label: "COMPOSITE", val: `${data.performance_score}%`, sub: "Weighted Performance" },
                { label: "AVERAGE", val: `${data.average_score}%`, sub: "Arithmetic Mean" },
                { label: "ATTENDANCE", val: `${attendance.percentage || 0}%`, sub: `${attendance.present || 0}/${attendance.total || 0} Days` },
                { label: "COURSES", val: subjects.length, sub: "Total Units Analyzed" }
              ].map((stat, i) => (
                <div key={i} style={S.card}>
                  <p style={{ fontSize: "10px", fontWeight: 800, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: "8px" }}>{stat.label}</p>
                  <div style={{ fontSize: "32px", fontWeight: 800, letterSpacing: "-0.05em" }}>{stat.val}</div>
                  <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>{stat.sub}</p>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "24px" }}>
              <div style={S.card}>
                <p style={S.sectionHeader}>Score Distribution</p>
                <div style={{ height: "240px", position: "relative" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        <Cell fill="var(--fg)" />
                        <Cell fill="var(--border)" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                    <div style={{ fontSize: "24px", fontWeight: 800 }}>{data.average_score}%</div>
                    <div style={{ fontSize: "9px", color: "var(--muted)", fontWeight: 700 }}>VERIFIED</div>
                  </div>
                </div>
              </div>
              <div style={S.card}>
                <p style={S.sectionHeader}>Subject Performance Area</p>
                <div style={{ height: "240px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sorted.slice(0, 8)}>
                      <defs>
                        <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--fg)" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="var(--fg)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="score" stroke="var(--fg)" fillOpacity={1} fill="url(#colorScore)" strokeWidth={3} />
                      <Tooltip />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div style={{ ...S.card, borderLeft: "8px solid var(--fg)" }}>
              <p style={S.sectionHeader}>AI Narrative Summary</p>
              <p style={{ fontSize: "15px", color: "var(--fg)", lineHeight: 1.8, whiteSpace: "pre-line", fontWeight: 500 }}>
                {data.summary}
              </p>
            </div>
          </div>
        );

      case "academics":
        return (
          <div className="animate-in" style={{ display: "grid", gap: "24px" }}>
             <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "24px" }}>
                <div style={S.card}>
                   <p style={S.sectionHeader}>Full Subject Breakdown</p>
                   <div style={{ display: "grid", gap: "12px" }}>
                     {sorted.map((s, i) => (
                       <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "rgba(0,0,0,0.01)", borderRadius: "12px" }}>
                         <span style={{ fontWeight: 600, fontSize: "14px" }}>{s.name}</span>
                         <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                           <span className="mono" style={{ fontWeight: 800 }}>{s.score}%</span>
                           <span className="badge" style={{ color: s.score >= 50 ? "inherit" : "#ef4444" }}>{s.score >= 50 ? "PASS" : "FAIL"}</span>
                         </div>
                       </div>
                     ))}
                   </div>
                </div>
                <div style={{ display: "grid", gap: "24px" }}>
                   <div style={S.card}>
                      <p style={S.sectionHeader}>Performance Density</p>
                      <div style={{ height: "200px" }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={sorted.slice(0, 5)}>
                            <Bar dataKey="score" fill="var(--fg)" radius={[4, 4, 0, 0]} />
                            <Tooltip cursor={{fill: 'transparent'}} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                   </div>
                   <div style={S.card}>
                      <p style={S.sectionHeader}>Grade Highlights</p>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                        <span style={{ fontSize: "13px", color: "var(--muted)" }}>Highest:</span>
                        <span style={{ fontSize: "13px", fontWeight: 700 }}>{sorted[0]?.name} ({sorted[0]?.score}%)</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                        <span style={{ fontSize: "13px", color: "var(--muted)" }}>Lowest:</span>
                        <span style={{ fontSize: "13px", fontWeight: 700 }}>{sorted[sorted.length-1]?.name} ({sorted[sorted.length-1]?.score}%)</span>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        );

      case "behavior":
        return (
          <div className="animate-in" style={{ display: "grid", gap: "24px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              <div style={S.card}>
                <p style={S.sectionHeader}>Conduct Evaluation</p>
                <div style={{ display: "grid", gap: "20px" }}>
                  {behavior.map((b, i) => (
                    <div key={i}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px", fontWeight: 600 }}>
                        <span>{b.trait}</span>
                        <span>{b.rating}/5</span>
                      </div>
                      <div style={{ display: "flex", gap: "4px" }}>
                        {[1, 2, 3, 4, 5].map(v => (
                          <div key={v} style={{ flex: 1, height: "8px", borderRadius: "2px", background: v <= b.rating ? "var(--fg)" : "var(--border)" }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={S.card}>
                <p style={S.sectionHeader}>Trait Radar</p>
                <div style={{ height: "350px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={behaviorRadar}>
                      <PolarGrid stroke="var(--border)" />
                      <PolarAngleAxis dataKey="trait" tick={{ fill: "var(--muted)", fontSize: 10, fontWeight: 700 }} />
                      <Radar dataKey="value" stroke="var(--fg)" fill="var(--fg)" fillOpacity={0.1} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
              <div style={S.card}>
                <p style={S.sectionHeader}>Attendance Impact</p>
                <div style={{ fontSize: "32px", fontWeight: 800 }}>{attendance.percentage}%</div>
                <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>Calculated risk: Low</p>
              </div>
              <div style={{ ...S.card, gridColumn: "span 2" }}>
                <p style={S.sectionHeader}>Attendance Heatmap (Simplified)</p>
                <div style={{ display: "flex", gap: "4px", height: "40px" }}>
                   {Array.from({length: 30}).map((_, i) => (
                     <div key={i} style={{ flex: 1, background: Math.random() > 0.1 ? "var(--fg)" : "var(--border)", borderRadius: "2px" }} />
                   ))}
                </div>
                <p style={{ fontSize: "10px", color: "var(--muted)", marginTop: "8px" }}>Last 30 session check-ins verified.</p>
              </div>
            </div>
          </div>
        );

      case "insights":
        return (
          <div className="animate-in" style={{ display: "grid", gap: "24px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "24px" }}>
              {recs.map((r, i) => (
                <div key={i} style={{ ...S.card, display: "flex", gap: "20px", borderLeft: `6px solid ${r.type === 'improvement' ? '#ef4444' : '#3b82f6'}` }}>
                   <div style={{ fontSize: "24px" }}>{r.type === 'improvement' ? "🎯" : "⚡"}</div>
                   <div>
                     <h4 style={{ fontWeight: 800, fontSize: "15px", marginBottom: "8px" }}>{r.subject} Insight</h4>
                     <p style={{ fontSize: "14px", color: "var(--muted)", lineHeight: 1.6 }}>{r.advice}</p>
                     <div style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
                        <span className="badge" style={{ fontSize: "9px" }}>PRIORITY: {r.type === 'improvement' ? "HIGH" : "NORMAL"}</span>
                        <span className="badge" style={{ fontSize: "9px" }}>IMPACT: +15% POTENTIAL</span>
                     </div>
                   </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "learning":
        return (
          <div className="animate-in" style={{ display: "grid", gap: "48px" }}>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "-12px" }}>
              <p style={{ fontSize: "11px", fontWeight: 800, color: "var(--muted)" }}>VIEW_MODE</p>
              <div style={{ display: "flex", background: "rgba(0,0,0,0.03)", padding: "3px", borderRadius: "8px" }}>
                <button 
                  onClick={() => setViewMode("grid")}
                  style={{ 
                    padding: "6px 16px", 
                    border: "none", 
                    background: viewMode === "grid" ? "var(--surface)" : "transparent", 
                    color: viewMode === "grid" ? "var(--fg)" : "var(--muted)",
                    borderRadius: "6px", 
                    fontSize: "11px", 
                    fontWeight: 700, 
                    cursor: "pointer",
                    boxShadow: viewMode === "grid" ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.2s ease"
                  }}
                >GRID</button>
                <button 
                  onClick={() => setViewMode("list")}
                  style={{ 
                    padding: "6px 16px", 
                    border: "none", 
                    background: viewMode === "list" ? "var(--surface)" : "transparent", 
                    color: viewMode === "list" ? "var(--fg)" : "var(--muted)",
                    borderRadius: "6px", 
                    fontSize: "11px", 
                    fontWeight: 700, 
                    cursor: "pointer",
                    boxShadow: viewMode === "list" ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.2s ease"
                  }}
                >LIST</button>
              </div>
            </header>

            {Object.entries(groupedResources).map(([subject, videos]) => (
              <div key={subject}>
                <p style={S.sectionTitle}>
                  <span style={{ width: "24px", height: "2px", background: "var(--fg)" }}></span>
                  {subject} Content Library
                </p>
                <div style={{ 
                  display: "grid", 
                  gridTemplateColumns: viewMode === "grid" ? "repeat(auto-fill, minmax(300px, 1fr))" : "1fr", 
                  gap: "24px" 
                }}>
                  {videos.map((v, j) => (
                    <a key={j} href={v.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
                      <div style={{ 
                        ...S.card, 
                        padding: viewMode === "list" ? "12px 20px" : "0", 
                        display: viewMode === "list" ? "flex" : "block",
                        gap: "24px",
                        alignItems: "center",
                        overflow: "hidden" 
                      }}>
                        <div style={{ 
                          position: "relative", 
                          width: viewMode === "list" ? "160px" : "100%",
                          paddingTop: viewMode === "list" ? "0" : "56.25%", 
                          height: viewMode === "list" ? "90px" : "auto",
                          background: "#000",
                          borderRadius: viewMode === "list" ? "8px" : "0",
                          flexShrink: 0,
                          overflow: "hidden"
                        }}>
                          {v.thumbnail && <img src={v.thumbnail} alt="" style={{ position: "absolute", top:0, left:0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.7 }} />}
                          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "32px", height: "32px", background: "rgba(255,255,255,0.2)", borderRadius: "100%", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
                          </div>
                        </div>
                        <div style={{ padding: viewMode === "list" ? "0" : "20px", flex: 1, minWidth: 0 }}>
                          <h4 style={{ fontSize: "14px", fontWeight: 700, lineHeight: 1.4, whiteSpace: viewMode === "list" ? "nowrap" : "normal", overflow: "hidden", textOverflow: "ellipsis" }}>{v.title || "Subject Mastery Lecture"}</h4>
                          <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "8px" }}>Source: Verified Academic Archive</p>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );

      default: return null;
    }
  };

  return (
    <div style={S.container}>
      <aside className="no-print" style={S.sidebar}>
        <div style={{ marginBottom: "56px", padding: "0 32px", textAlign: "left" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            <div style={{ width: "32px", height: "32px", background: "var(--fg)", borderRadius: "8px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 900, letterSpacing: "-0.04em" }}>ANALYSIS</h2>
          </div>
          <div style={{ border: "1px solid var(--border)", padding: "16px", borderRadius: "12px", background: "rgba(0,0,0,0.01)" }}>
             <p style={{ fontSize: "13px", fontWeight: 800 }}>{data.student_name}</p>
             <p style={{ fontSize: "10px", color: "var(--muted)", marginTop: "2px" }}>ID: {data.student_class} // BATCH_26</p>
          </div>
        </div>

        <nav style={{ flex: 1 }}>
          {[
            { id: "overview", label: "Overview", icon: "overview" },
            { id: "academics", label: "Academics", icon: "academics" },
            { id: "behavior", label: "Conduct & Behavior", icon: "behavior" },
            { id: "insights", label: "Insights & Strategy", icon: "insights" },
            { id: "learning", label: "Learning Library", icon: "learning" },
          ].map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} style={S.navItem(activeTab === item.id)}>
              {ICONS[item.icon]}
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{ marginTop: "auto", display: "grid", gap: "12px", padding: "0 32px" }}>
           <button onClick={handleDownload} style={{ width: "100%", padding: "12px", borderRadius: "12px", background: "var(--fg)", color: "var(--bg)", fontWeight: 700, fontSize: "13px", border: "none" }}>
             Download PDF
           </button>
           <button onClick={onReset} style={{ color: "#991b1b", opacity: 0.8, background: "transparent", border: "none", fontSize: "12px", fontWeight: 600 }}>
             Terminate Session
           </button>
        </div>
      </aside>

      <main style={S.main}>
        <header style={{ marginBottom: "56px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
             <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "8px" }}>
                Active Module: {activeTab.toUpperCase()}
             </div>
             <h1 style={{ fontSize: "48px", fontWeight: 900, letterSpacing: "-0.05em" }}>
                {NAV_ITEMS.find(n => n.id === activeTab)?.label || "Analysis Report"}
             </h1>
          </div>
          <div className="no-print mono" style={{ textAlign: "right", fontSize: "10px", color: "var(--muted)" }}>
             SYSTEM_STABLE // 256-BIT_ENCRYPTED
          </div>
        </header>

        {renderContent()}

        <footer style={{ marginTop: "120px", borderTop: "1px solid var(--border)", paddingTop: "40px", textAlign: "center" }}>
           <p className="mono" style={{ fontSize: "10px", color: "var(--muted)" }}>
             © 2026 ARCHIVE LABS // AUTOMATED EDUCATIONAL ASSESSMENT SYSTEMS
           </p>
        </footer>
      </main>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          main { margin-left: 0 !important; padding: 0 !important; }
          .card { border: 1px solid #eee !important; break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}

const NAV_ITEMS = [
  { id: "overview", label: "Overview" },
  { id: "academics", label: "Academics" },
  { id: "behavior", label: "Conduct & Behavior" },
  { id: "insights", label: "Insights & Strategy" },
  { id: "learning", label: "Learning Library" },
];