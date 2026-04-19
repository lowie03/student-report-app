import { useState } from "react";
import axios from "axios";
import Dashboard from "./Dashboard";

const API_URL = "http://localhost:8000";

export default function App() {
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

  // ── Upload screen ───────────────────────────────────────────────────────
  return (
    <div style={{
      fontFamily: "'Outfit', system-ui, sans-serif",
      minHeight: "100vh",
      background: "#06080F",
      color: "#E8ECF4",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      position: "relative",
      overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .upload-zone {
          position: relative;
          width: 100%;
          max-width: 520px;
          border: 2px dashed #2A3352;
          border-radius: 20px;
          padding: 56px 40px;
          text-align: center;
          cursor: pointer;
          transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
          background: rgba(16, 20, 36, 0.6);
          backdrop-filter: blur(12px);
        }
        .upload-zone:hover, .upload-zone.drag-over {
          border-color: #5B8DEF;
          background: rgba(91, 141, 239, 0.06);
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(91, 141, 239, 0.12);
        }
        .upload-zone.drag-over {
          border-style: solid;
        }

        .glow-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.15;
          pointer-events: none;
        }

        .upload-icon {
          width: 72px;
          height: 72px;
          margin: 0 auto 24px;
          border-radius: 18px;
          background: linear-gradient(135deg, #5B8DEF 0%, #7C5BEF 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          box-shadow: 0 8px 32px rgba(91, 141, 239, 0.25);
        }

        .progress-bar-track {
          width: 100%;
          max-width: 520px;
          height: 6px;
          background: #1A1F33;
          border-radius: 3px;
          margin-top: 24px;
          overflow: hidden;
        }
        .progress-bar-fill {
          height: 100%;
          border-radius: 3px;
          background: linear-gradient(90deg, #5B8DEF, #7C5BEF);
          transition: width 0.4s ease-out;
        }

        .loading-pulse {
          animation: pulse 1.8s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        .error-box {
          margin-top: 20px;
          padding: 14px 20px;
          border-radius: 12px;
          background: rgba(239, 91, 91, 0.1);
          border: 1px solid rgba(239, 91, 91, 0.25);
          color: #EF5B5B;
          font-size: 14px;
          max-width: 520px;
          width: 100%;
        }

        .format-tag {
          display: inline-flex;
          padding: 4px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 500;
          background: rgba(91, 141, 239, 0.1);
          color: #8BAEF5;
          letter-spacing: 0.5px;
        }
      `}</style>

      {/* Background orbs */}
      <div className="glow-orb" style={{ width: 400, height: 400, top: -100, left: -100, background: "#5B8DEF" }} />
      <div className="glow-orb" style={{ width: 300, height: 300, bottom: -60, right: -60, background: "#7C5BEF" }} />

      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: 40, position: "relative", zIndex: 1 }}>
        <h1 style={{
          fontSize: 36,
          fontWeight: 700,
          letterSpacing: -1,
          marginBottom: 10,
          background: "linear-gradient(135deg, #E8ECF4 0%, #8BAEF5 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          Student Report Analyzer
        </h1>
        <p style={{ fontSize: 16, color: "#6B7A99", fontWeight: 400, maxWidth: 420, lineHeight: 1.5 }}>
          Upload a report card and get AI-powered performance analysis, predictions, and personalized recommendations
        </p>
      </div>

      {/* Upload zone */}
      {!loading ? (
        <div
          className={`upload-zone ${dragOver ? "drag-over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById("file-input").click()}
        >
          <input
            id="file-input"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />

          <div className="upload-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>

          <p style={{ fontSize: 17, fontWeight: 600, marginBottom: 8, color: "#C8D1E4" }}>
            {dragOver ? "Drop your file here" : "Drag & drop your report card"}
          </p>
          <p style={{ fontSize: 14, color: "#5A6580", marginBottom: 20 }}>
            or click to browse files
          </p>

          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <span className="format-tag">PDF</span>
            <span className="format-tag">JPG</span>
            <span className="format-tag">PNG</span>
          </div>
        </div>
      ) : (
        /* Loading state */
        <div style={{ width: "100%", maxWidth: 520, textAlign: "center", position: "relative", zIndex: 1 }}>
          <div className="upload-icon" style={{ margin: "0 auto 20px" }}>
            <svg className="loading-pulse" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>

          <p style={{ fontSize: 17, fontWeight: 600, marginBottom: 6, color: "#C8D1E4" }}>
            Analyzing {fileName}
          </p>
          <p className="loading-pulse" style={{ fontSize: 14, color: "#5A6580", marginBottom: 16 }}>
            {progress < 40
              ? "Uploading report card..."
              : progress < 70
              ? "Extracting data with Gemini AI..."
              : progress < 90
              ? "Running predictions and scoring..."
              : "Building your dashboard..."}
          </p>

          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${Math.min(progress + 50, 95)}%` }} />
          </div>
        </div>
      )}

      {error && (
        <div className="error-box">
          {error}
        </div>
      )}

      {/* Footer */}
      <p style={{
        position: "absolute",
        bottom: 24,
        fontSize: 12,
        color: "#3A4360",
        letterSpacing: 0.5,
      }}>
        Powered by Gemini AI + YouTube Data API
      </p>
    </div>
  );
}