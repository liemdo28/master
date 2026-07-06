import { useEffect, useState } from "react";
import { trpc } from "../trpc";

type JobStatus =
  | "queued"
  | "recording"
  | "rendering"
  | "done"
  | "failed"
  | "unknown";

interface StatusData {
  id: string;
  status: JobStatus;
  progress: number;
  message: string;
  steps: string[];
  error?: string;
  outputPath?: string;
}

const STATUS_COLORS: Record<JobStatus, string> = {
  queued: "#94a3b8",
  recording: "#60a5fa",
  rendering: "#f59e0b",
  done: "#22c55e",
  failed: "#ef4444",
  unknown: "#94a3b8",
};

const STATUS_LABELS: Record<JobStatus, string> = {
  queued: "Queued",
  recording: "Recording Browser Session",
  rendering: "Rendering Video",
  done: "Done",
  failed: "Failed",
  unknown: "Unknown",
};

const STATUS_ICONS: Record<JobStatus, string> = {
  queued: "⏳",
  recording: "🎥",
  rendering: "✨",
  done: "✅",
  failed: "❌",
  unknown: "❔",
};

const PRESETS = [
  { label: "Admin Dashboard", url: "https://app.bakudanramen.com/admin/login", username: "admin" },
  { label: "Sushi Bistro POS", url: "https://pos.rawsushi.com/login", username: "manager" },
];

export default function LiveWalkthrough() {
  const [targetUrl, setTargetUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [subtitles, setSubtitles] = useState(true);
  const [voice, setVoice] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const createMutation = trpc.walkthrough.create.useMutation();

  // Poll status using tRPC's built-in refetchInterval
  const statusQuery = trpc.walkthrough.status.useQuery(
    { jobId: activeJobId ?? "" },
    {
      enabled: !!activeJobId,
      refetchInterval: 3000,
    }
  );

  const statusData: StatusData | null = statusQuery.data ?? null;

  const isRunning =
    statusData?.status === "queued" ||
    statusData?.status === "recording" ||
    statusData?.status === "rendering";

  const statusColor = statusData?.status
    ? STATUS_COLORS[statusData.status] ?? "#94a3b8"
    : "#94a3b8";

  // When done, grab the download URL
  useEffect(() => {
    if (statusData?.status === "done" && statusData.outputPath && !videoUrl) {
      setVideoUrl(statusData.outputPath);
    }
  }, [statusData, videoUrl]);

  const handleSubmit = async () => {
    if (!targetUrl.trim()) {
      setFormError("Please enter a target URL");
      return;
    }
    if (!targetUrl.match(/^https?:\/\//i)) {
      setFormError("URL must start with http:// or https://");
      return;
    }
    setFormError("");
    setVideoUrl(null);
    try {
      const result = await createMutation.mutateAsync({
        targetUrl: targetUrl.trim(),
        username: username.trim() || undefined,
        password: password || undefined,
        subtitles,
        voice,
      });
      setActiveJobId(result.jobId);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    }
  };

  const applyPreset = (preset: typeof PRESETS[number]) => {
    setTargetUrl(preset.url);
    setUsername(preset.username);
    setPassword("");
  };

  const handleReset = () => {
    setActiveJobId(null);
    setVideoUrl(null);
    setFormError("");
  };

  return (
    <div className="wt-page">
      {/* ── Hero header ── */}
      <div className="wt-hero">
        <div className="wt-hero-icon">🎬</div>
        <div>
          <h1 className="page-title">Live Walkthrough Generator</h1>
          <p className="page-subtitle">
            Enter a URL + login → get a guided video walkthrough with optional AI narration
          </p>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="wt-form-card fade-in">
        {/* Quick presets */}
        {!activeJobId && (
          <div className="wt-presets">
            <span className="wt-presets-label">Quick start:</span>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                className="wt-preset-chip"
                onClick={() => applyPreset(p)}
                type="button"
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">
            <span>Target URL</span>
            <span className="form-label-required">*</span>
          </label>
          <input
            className="form-input wt-input-lg"
            type="url"
            placeholder="https://app.example.com"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            disabled={isRunning}
          />
        </div>

        <div className="wt-credentials-row">
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              className="form-input"
              type="text"
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isRunning}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isRunning}
            />
          </div>
        </div>

        <div className="wt-options">
          <label className={`wt-toggle ${subtitles ? "active" : ""}`}>
            <input
              type="checkbox"
              checked={subtitles}
              onChange={(e) => setSubtitles(e.target.checked)}
              disabled={isRunning}
            />
            <span className="wt-toggle-icon">💬</span>
            <span className="wt-toggle-label">
              <span className="wt-toggle-title">Subtitles</span>
              <span className="wt-toggle-desc">
                Burn captions describing each screen
              </span>
            </span>
            <span className="wt-toggle-check">{subtitles ? "ON" : "OFF"}</span>
          </label>
          <label className={`wt-toggle ${voice ? "active" : ""}`}>
            <input
              type="checkbox"
              checked={voice}
              onChange={(e) => setVoice(e.target.checked)}
              disabled={isRunning}
            />
            <span className="wt-toggle-icon">🎙️</span>
            <span className="wt-toggle-label">
              <span className="wt-toggle-title">Voice Narration</span>
              <span className="wt-toggle-desc">
                Add AI voiceover via Edge TTS
              </span>
            </span>
            <span className="wt-toggle-check">{voice ? "ON" : "OFF"}</span>
          </label>
        </div>

        {/* Advanced options (collapsible) */}
        <button
          type="button"
          className="wt-advanced-toggle"
          onClick={() => setShowAdvanced(!showAdvanced)}
          disabled={isRunning}
        >
          {showAdvanced ? "▼" : "▶"} Advanced options
        </button>
        {showAdvanced && (
          <div className="wt-advanced-panel">
            <div className="form-group">
              <label className="form-label">Recording Quality</label>
              <select className="form-select" disabled={isRunning}>
                <option value="1080p">1080p (recommended)</option>
                <option value="720p">720p (faster)</option>
                <option value="4k">4K (slower)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Max Pages to Visit</label>
              <input
                type="number"
                className="form-input"
                defaultValue={6}
                min={1}
                max={20}
                disabled={isRunning}
              />
            </div>
          </div>
        )}

        {formError && (
          <div className="alert alert-error fade-in">
            <span className="alert-icon">⚠️</span> {formError}
          </div>
        )}

        <div className="wt-submit-row">
          {!activeJobId ? (
            <button
              className="btn btn-primary wt-submit-btn"
              onClick={handleSubmit}
              disabled={isRunning || createMutation.isPending || !targetUrl.trim()}
            >
              {createMutation.isPending ? (
                <>
                  <span className="wt-spinner" /> Starting...
                </>
              ) : (
                <>🚀 Generate Walkthrough</>
              )}
            </button>
          ) : (
            <button
              className="btn btn-ghost"
              onClick={handleReset}
              disabled={isRunning}
            >
              Cancel & Start Over
            </button>
          )}
        </div>
      </div>

      {/* ── Status / Progress ── */}
      {statusData && (
        <div className="wt-status-card fade-in" key={statusData.status}>
          <div className="wt-status-header">
            <div
              className="wt-status-dot pulse"
              style={{ background: statusColor }}
            />
            <span className="wt-status-icon">{STATUS_ICONS[statusData.status]}</span>
            <span className="wt-status-label" style={{ color: statusColor }}>
              {STATUS_LABELS[statusData.status] ?? statusData.status}
            </span>
            {statusData.status !== "unknown" && (
              <span className="wt-progress-pct">{statusData.progress}%</span>
            )}
          </div>

          {statusData.status !== "unknown" && (
            <div className="wt-progress-bar">
              <div
                className="wt-progress-fill"
                style={{
                  width: `${statusData.progress}%`,
                  background: statusColor,
                }}
              />
            </div>
          )}

          <p className="wt-status-message">{statusData.message}</p>

          {statusData.error && (
            <div className="alert alert-error fade-in" style={{ marginTop: 12 }}>
              <span className="alert-icon">⚠️</span> {statusData.error}
            </div>
          )}

          {/* Steps timeline */}
          {statusData.steps.length > 0 && (
            <div className="wt-steps">
              <div className="wt-steps-title">Steps recorded:</div>
              {statusData.steps.map((step, i) => (
                <div key={i} className="wt-step fade-in" style={{ animationDelay: `${i * 80}ms` }}>
                  <div className="wt-step-dot" />
                  <span className="wt-step-text">{step}</span>
                  <span className="wt-step-num">#{i + 1}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Video Preview ── */}
      {videoUrl && statusData?.status === "done" && (
        <div className="wt-result-card fade-in">
          <div className="wt-result-header">
            <h2 className="wt-result-title">🎉 Your walkthrough is ready</h2>
            <div className="wt-result-actions">
              <a
                href={videoUrl}
                download="walkthrough.mp4"
                className="btn btn-primary"
              >
                ⬇ Download MP4
              </a>
              <button className="btn btn-ghost" onClick={handleReset}>
                New Walkthrough
              </button>
            </div>
          </div>
          <video
            className="wt-video-player"
            src={videoUrl}
            controls
            autoPlay
            preload="metadata"
          >
            Your browser does not support video playback.
          </video>
        </div>
      )}

      {/* ── Empty state hint ── */}
      {!activeJobId && !statusData && (
        <div className="wt-empty-hint">
          <div className="wt-empty-step">
            <span className="wt-empty-num">1</span>
            <div>
              <strong>Enter URL & login</strong>
              <p>Type the web app URL and credentials (if any)</p>
            </div>
          </div>
          <div className="wt-empty-step">
            <span className="wt-empty-num">2</span>
            <div>
              <strong>Toggle subtitles & voice</strong>
              <p>Optional: enable for captions and AI narration</p>
            </div>
          </div>
          <div className="wt-empty-step">
            <span className="wt-empty-num">3</span>
            <div>
              <strong>Click Submit</strong>
              <p>Browser auto-records the entire walkthrough as video</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
