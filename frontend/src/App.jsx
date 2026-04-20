import { useState, useEffect } from "react";
import axios from "axios";
import Dashboard from "./Dashboard";

const API_URL = "http://localhost:8000";

export default function App() {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);

  const processFile = async (file) => {
    if (!file) return;

    const allowed = [".pdf", ".jpg", ".jpeg", ".png"];
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!allowed.includes(ext)) {
      setError("Please upload a PDF, JPG, or PNG file.");
      return;
    }

    setFileName(file.name);
    setLoading(true);
    setError(null);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(`${API_URL}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 40));
        },
      });

      setProgress(100);
      setTimeout(() => setData(res.data), 400);
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        "Analysis failed. Make sure the backend is running on port 8000.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => processFile(e.target.files[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    processFile(e.dataTransfer.files[0]);
  };

  // ── If we have data, show the dashboard ─────────────────────────────────
  if (data) {
    return <Dashboard data={data} onReset={() => { setData(null); setFileName(""); setProgress(0); }} />;
  }

  return (
    <div className="animate-in" style={{ 
      minHeight: "100vh", 
      display: "flex", 
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "var(--space-4)"
    }}>
      <header style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>
        <div style={{ 
          display: "inline-flex", 
          padding: "6px 12px", 
          borderRadius: "99px", 
          background: "var(--ring)", 
          fontSize: "12px", 
          fontWeight: 600, 
          color: "var(--muted)",
          marginBottom: "var(--space-3)",
          border: "1px solid var(--border)"
        }}>
          NEW VERSION 2.0 AVAILABLE
        </div>
        <h1 style={{ fontSize: "56px", lineHeight: 1.1, marginBottom: "var(--space-3)" }}>
          Insights from every <br/> scholastic record.
        </h1>
        <p style={{ color: "var(--muted)", maxWidth: "500px", margin: "0 auto", fontSize: "18px" }}>
          Upload your students academic report and let our AI transform raw data into actionable educational strategies.
        </p>
      </header>

      <div 
        className="card"
        style={{ 
          width: "100%", 
          maxWidth: "600px", 
          padding: "var(--space-6)",
          textAlign: "center",
          cursor: "pointer",
          borderStyle: dragOver ? "solid" : "dashed",
          borderColor: dragOver ? "var(--fg)" : "var(--border)",
          background: dragOver ? "var(--ring)" : "var(--surface)",
          boxShadow: "0 20px 40px -10px rgba(0,0,0,0.05)"
        }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById("file-input").click()}
      >
        <input id="file-input" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileSelect} style={{ display: "none" }} />
        
        <div style={{ 
          width: 64, 
          height: 64, 
          background: "var(--fg)", 
          color: "var(--bg)", 
          borderRadius: "16px", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          margin: "0 auto var(--space-4)",
          fontSize: 24
        }}>
          {loading ? (
            <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : "+"}
        </div>
        
        <h2 style={{ fontSize: 20, marginBottom: "4px" }}>
          {loading ? "Analyzing Document..." : "Drop report to begin"}
        </h2>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>
          {loading ? "This usually takes less than 10 seconds" : "PDF, PNG or JPG up to 10MB"}
        </p>

        {loading && (
          <div style={{ marginTop: "var(--space-4)", width: "100%", maxWidth: "300px", margin: "var(--space-4) auto 0" }}>
            <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", background: "var(--fg)", width: `${progress}%`, transition: "width 0.3s" }} />
            </div>
            <p className="mono" style={{ fontSize: 10, marginTop: "8px", color: "var(--muted)" }}>
              {progress}% PROCESSED
            </p>
          </div>
        )}
      </div>

      {error && (
        <div style={{ 
          marginTop: "var(--space-4)", 
          color: "#c0392b", 
          fontSize: "14px", 
          background: "rgba(192, 57, 43, 0.08)", 
          padding: "8px 16px", 
          borderRadius: "8px",
          border: "1px solid rgba(192, 57, 43, 0.2)"
        }}>
          {error}
        </div>
      )}

      <footer style={{ marginTop: "var(--space-6)", color: "var(--muted)", fontSize: "12px", borderTop: "1px solid var(--border)", paddingTop: "var(--space-4)", width: "100%", textAlign: "center" }}>
        © 2026 ARCHIVE LABS. PRIVACY COMPLIANT. DATA SECURE.
      </footer>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

