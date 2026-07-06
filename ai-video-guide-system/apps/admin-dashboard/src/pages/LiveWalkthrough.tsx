import { useState } from "react";
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
  recording: "Recording",
  rendering: "Rendering",
  done: "Done",
  failed: "Failed",
  unknown: "Unknown",
};

export default function LiveWalkthrough() {
  const [targetUrl, setTargetUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [subtitles, setSubtitles] = useState(true);
  const [voice, setVoice] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [formError, setFormError] = useState("");

  const createMutation = trpc.walkthrough.create.useMutation();

  // Poll status using tRPC's built-in refetchInterval
  const statusQuery = trpc.walkthrough.status.useQuery(
    { jobId: activeJobId ?? "" },
    {
      enabled: !!activeJobId,
      refetchInterval: 3000,
    }
  );

  const statusData: StatusData | null =
    statusQuery.data ?? null;

  const isRunning =
    statusData?.status === "queued" ||
    statusData?.status === "recording" ||
    statusData?.status === "rendering";

  const statusColor = statusData?.status
    ? STATUS_COLORS[statusData.status] ?? "#94a3b8"
    : "#94a3b8";

  const handleSubmit = async () => {
    if (!targetUrl.trim()) {
      setFormError("Please enter a target URL");
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
      setFormError(String(err));
    }
  };

  // When done, grab the download URL
  if (statusData?.status === "done" && statusData.outputPath && !videoUrl) {
    setVideoUrl(statusData.outputPath);
  }

  return (
    <div>
      <div className="detail-header">
        <div className="detail-title-group">
          <h1 className="page-title">Live Walkthrough</h1>
          <p className="page-subtitle">
            Enter a URL to automatically record a guided video walkthrough
          </p>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="wt-form-card">
        <div className="form-group">
          <label className="form-label">Target URL *</label>
          <input
            className="form-input"
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
          <label className="wt-toggle">
            <input
              type="checkbox"
              checked={subtitles}
              onChange={(e) => setSubtitles(e.target.checked)}
              disabled={isRunning}
            />
            <span className="wt-toggle-label">
              <span className="wt-toggle-title">Subtitles</span>
              <span className="wt-toggle-desc">Burn captions into the video</span>
            </span>
          </label>
          <label className="wt-toggle">
            <input
              type="checkbox"
              checked={voice}
              onChange={(e) => setVoice(e.target.checked)}
              disabled={isRunning}
            />
            <span className="wt-toggle-label">
              <span className="wt-toggle-title">Voice Narration</span>
              <span className="wt-toggle-desc">Add AI voiceover via Edge TTS</span>
            </span>
          </label>
        </div>

        {formError && <div className="alert alert-error">{formError}</div>}

        <div className="wt-submit-row">
          <button
            className="btn btn-primary wt-submit-btn"
            onClick={handleSubmit}
            disabled={isRunning || createMutation.isPending || !targetUrl.trim()}
          >
            {isRunning ? (
              <>
                <span className="wt-spinner" />
                Running...
              </>
            ) : createMutation.isPending ? (
              "Starting..."
            ) : (
              "🚀 Generate Walkthrough"
            )}
          </button>
        </div>
      </div>

      {/* ── Status / Progress ── */}
      {statusData && (
        <div className="wt-status-card">
          <div className="wt-status-header">
            <div className="wt-status-dot" style={{ background: statusColor }} />
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
                style={{ width: `${statusData.progress}%`, background: statusColor }}
              />
            </div>
          )}

          <p className="wt-status-message">{statusData.message}</p>

          {statusData.error && (
            <div className="alert alert-error" style={{ marginTop: 12 }}>
              {statusData.error}
            </div>
          )}

          {/* Steps timeline */}
          {statusData.steps.length > 0 && (
            <div className="wt-steps">
              {statusData.steps.map((step, i) => (
                <div key={i} className="wt-step">
                  <div className="wt-step-dot" />
                  <span className="wt-step-text">{step}</span>
                </div>
              ))}
            </div>
          )}

          {/* Download button */}
          {videoUrl && statusData.status === "done" && (
            <div className="wt-download">
              <a
                href={videoUrl}
                download="walkthrough.mp4"
                className="btn btn-primary"
              >
                ⬇ Download Video
              </a>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setActiveJobId(null);
                  setVideoUrl(null);
                }}
              >
                New Walkthrough
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
