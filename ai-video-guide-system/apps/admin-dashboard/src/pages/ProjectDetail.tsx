import { useState } from "react";
import { trpc } from "../trpc";

interface Props {
  projectId: string;
  onBack: () => void;
}

export default function ProjectDetail({ projectId, onBack }: Props) {
  const [showStepModal, setShowStepModal] = useState(false);
  const [stepDesc, setStepDesc] = useState("");
  const [stepAction, setStepAction] = useState("click");
  const [stepSelector, setStepSelector] = useState("");
  const [stepValue, setStepValue] = useState("");
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: project } = trpc.project.byId.useQuery({ id: projectId });
  const { data: steps } = trpc.step.listByProject.useQuery({ projectId });
  const { data: renderJobs } = trpc.renderJob.listByProject.useQuery({ projectId });

  const updateProject = trpc.project.update.useMutation({ onSuccess: () => utils.project.byId.invalidate({ id: projectId }) });
  const createStep = trpc.step.create.useMutation({ onSuccess: () => { utils.step.listByProject.invalidate({ projectId }); setShowStepModal(false); setStepDesc(""); setStepSelector(""); setStepValue(""); } });
  const deleteStep = trpc.step.delete.useMutation({ onSuccess: () => utils.step.listByProject.invalidate({ projectId }) });
  const createRenderJob = trpc.renderJob.create.useMutation();
  const updateRenderJob = trpc.renderJob.updateStatus.useMutation({ onSuccess: () => utils.renderJob.listByProject.invalidate({ projectId }) });

  const latestJob = renderJobs && renderJobs.length > 0 ? (renderJobs[0] as Record<string, unknown>) : null;

  const handleRun = async () => {
    if (!project || !steps || steps.length === 0) return;
    setRunStatus("recording");
    setRunError(null);
    try {
      const resp = await fetch("http://localhost:3002/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          workflow: {
            projectId,
            targetUrl: project.target_url,
            steps: steps.map((s, i) => ({
              orderIndex: i,
              description: s.description as string,
              actionType: s.action_type as string,
              selector: s.selector as string | undefined,
              selectorType: s.selector_type as string | undefined,
              value: s.value as string | undefined,
              delayMs: s.delay_ms as number,
            })),
            selectors: {},
          },
        }),
      });
      const result = await resp.json();
      if (result.success) {
        setRunStatus("done");
      } else {
        setRunStatus("failed");
        setRunError(result.errors?.join("; ") ?? "Unknown error");
      }
    } catch (err) {
      setRunStatus("failed");
      setRunError(String(err));
    }
  };

  const handleRender = async () => {
    if (!project || !steps || steps.length === 0) return;
    setRunStatus("rendering");
    try {
      const jobResp = await fetch("http://localhost:3003/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          renderJobId: crypto.randomUUID(),
          projectId,
          steps: steps.map((s, i) => ({
            stepId: s.id as string,
            orderIndex: i,
            description: s.description as string,
            screenshotPath: `storage/projects/${projectId}/step-${i}-masked.png`,
            delayMs: s.delay_ms as number,
          })),
          outputPath: `videos/${projectId}.mp4`,
        }),
      });
      const result = await jobResp.json();
      if (result.success) {
        setRunStatus("done");
      } else {
        setRunStatus("failed");
        setRunError(result.error ?? "Render failed");
      }
    } catch (err) {
      setRunStatus("failed");
      setRunError(String(err));
    }
  };

  const handleDelete = () => {
    if (!confirm("Delete this project and all its data?")) return;
    trpc.project.delete.useMutation({ onSuccess: onBack }).mutate({ id: projectId });
  };

  if (!project) return <div className="loading">Loading...</div>;

  return (
    <div>
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }} onClick={onBack}>
        ← Back
      </button>

      <div className="detail-header">
        <div className="detail-title-group">
          <h1 className="detail-title">{project.name as string}</h1>
          <p className="detail-url">{project.target_url as string}</p>
        </div>
        <div className="detail-actions">
          <span className={`badge badge-${project.status as string}`}>{project.status as string}</span>
          {runStatus === "recording" && <span className="badge badge-recording">Recording...</span>}
          {runStatus === "rendering" && <span className="badge badge-rendering">Rendering...</span>}
          {runStatus === "done" && <span className="badge badge-done">Done ✓</span>}
          {runStatus === "failed" && <span className="badge badge-failed">Failed ✗</span>}
        </div>
      </div>

      {runError && <div className="alert alert-error">{runError}</div>}

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 32 }}>
        <div className="stat-card">
          <div className="stat-value">{steps?.length ?? 0}</div>
          <div className="stat-label">Steps</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{renderJobs?.length ?? 0}</div>
          <div className="stat-label">Render Jobs</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: 16 }}>{latestJob ? (latestJob.status as string) : "—"}</div>
          <div className="stat-label">Latest Render</div>
        </div>
      </div>

      {/* Steps */}
      <div className="section">
        <div className="section-header">
          <h2 className="section-title">Workflow Steps</h2>
          <button className="btn btn-primary btn-sm" onClick={() => setShowStepModal(true)}>+ Add Step</button>
        </div>

        {steps && steps.length > 0 ? (
          <div className="steps-list">
            {(steps as Array<Record<string, unknown>>).map((s, i) => (
              <div key={s.id as string} className="step-item">
                <div className="step-number">{i + 1}</div>
                <div className="step-body">
                  <div className="step-desc">{s.description as string}</div>
                  <div className="step-meta">
                    <span>{s.action_type as string}</span>
                    {s.selector && <span style={{ fontFamily: "monospace" }}>{s.selector as string}</span>}
                    <span>{s.delay_ms as number}ms</span>
                    <span className={`badge badge-${s.status as string}`}>{s.status as string}</span>
                  </div>
                </div>
                <div className="step-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => deleteStep.mutate({ id: s.id as string })}>✕</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty" style={{ padding: "40px 20px" }}>
            <p>No steps yet. Add steps to define your workflow.</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="section">
        <h2 className="section-title" style={{ marginBottom: 16 }}>Actions</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={handleRun} disabled={!steps || steps.length === 0 || runStatus === "recording" || runStatus === "rendering"}>
            ▶ Run Recording
          </button>
          <button className="btn btn-ghost" onClick={handleRender} disabled={!steps || steps.length === 0 || runStatus === "recording" || runStatus === "rendering"}>
            🎬 Render Video
          </button>
          <button className="btn btn-ghost" onClick={() => updateProject.mutate({ id: projectId, status: "archived" })}>
            Archive
          </button>
          <button className="btn btn-danger btn-sm" onClick={handleDelete}>Delete Project</button>
        </div>
      </div>

      {showStepModal && (
        <div className="modal-overlay" onClick={() => setShowStepModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Add Step</h2>
            <div className="form-group">
              <label className="form-label">Description *</label>
              <input className="form-input" placeholder="e.g. Click the Login button" value={stepDesc} onChange={(e) => setStepDesc(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Action Type</label>
              <select className="form-select" value={stepAction} onChange={(e) => setStepAction(e.target.value)}>
                <option value="click">click</option>
                <option value="fill">fill</option>
                <option value="navigate">navigate</option>
                <option value="hover">hover</option>
                <option value="scroll">scroll</option>
                <option value="wait">wait</option>
                <option value="screenshot">screenshot</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Selector / Value</label>
              <input className="form-input" placeholder={stepAction === "fill" || stepAction === "navigate" ? "Value" : "#login-button"} value={stepSelector} onChange={(e) => setStepSelector(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowStepModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => createStep.mutate({ projectId, description: stepDesc, actionType: stepAction as "click", selector: stepSelector || undefined, value: stepValue || undefined })} disabled={!stepDesc.trim()}>
                Add Step
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
