import { useState } from "react";
import { trpc } from "../trpc";

interface Props {
  onSelectProject: (id: string) => void;
}

export default function ProjectList({ onSelectProject }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetUrl, setTargetUrl] = useState("");

  const { data: projects, isLoading } = trpc.project.list.useQuery();
  const utils = trpc.useUtils();
  const createProject = trpc.project.create.useMutation({
    onSuccess: () => {
      utils.project.list.invalidate();
      setShowModal(false);
      setName(""); setDescription(""); setTargetUrl("");
    },
  });

  const handleCreate = () => {
    if (!name.trim() || !targetUrl.trim()) return;
    createProject.mutate({ name: name.trim(), description: description.trim() || undefined, targetUrl: targetUrl.trim() });
  };

  const getStatusBadge = (status: string) => (
    <span className={`badge badge-${status}`}>{status}</span>
  );

  return (
    <div>
      <div className="detail-header">
        <div className="detail-title-group">
          <h1 className="page-title">Video Projects</h1>
          <p className="page-subtitle">Manage your AI video guide projects</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + New Project
        </button>
      </div>

      {isLoading ? (
        <div className="loading">Loading projects...</div>
      ) : projects && projects.length > 0 ? (
        <div className="project-grid">
          {projects.map((p) => (
            <div key={p.id} className="project-card" onClick={() => onSelectProject(p.id as string)}>
              <div className="project-card-header">
                <div>
                  <div className="project-name">{p.name as string}</div>
                  <div className="project-url">{p.target_url as string}</div>
                </div>
                {getStatusBadge(p.status as string)}
              </div>
              {p.description && <p className="project-desc">{p.description as string}</p>}
              <div className="project-meta">
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {(p.created_at as string).substring(0, 10)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">
          <div className="empty-icon">🎬</div>
          <p>No projects yet.</p>
          <p style={{ marginTop: 8 }}>Create your first video guide project to get started.</p>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">New Video Project</h2>
            <div className="form-group">
              <label className="form-label">Project Name *</label>
              <input className="form-input" placeholder="e.g. GitHub Onboarding" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Target URL *</label>
              <input className="form-input" type="url" placeholder="https://app.example.com" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" placeholder="Brief description of the video guide..." value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            {createProject.error && (
              <div className="alert alert-error">{String(createProject.error.message)}</div>
            )}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={createProject.isPending || !name.trim() || !targetUrl.trim()}>
                {createProject.isPending ? "Creating..." : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
