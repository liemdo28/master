import fs from 'fs';
import path from 'path';
export class ProjectConnector {
  constructor() {
    this.projects = {
      'dashboard': { name: 'Dashboard bakudanramen.com', local_path: 'E:/Project/Master/dashboard.bakudanramen.com', read_capability: ['tasks','users','projects'], write_capability: ['tasks','content'], approval_required: true },
      'raw-website': { name: 'rawsushibar.com', local_path: 'E:/Project/Master/RawSushi', read_capability: ['files','content','menu'], write_capability: ['content','menu','posts'], approval_required: true },
      'bakudan-website': { name: 'bakudanramen.com', local_path: 'E:/Project/Master/Bakudan', read_capability: ['files','content','menu'], write_capability: ['content','menu','posts'], approval_required: true },
      'integration-system': { name: 'Integration System', type: 'remote', read_capability: ['logs','health','qa'], write_capability: ['execute'], approval_required: true },
      'whatsapp-api': { name: 'WhatsApp API', type: 'remote', read_capability: ['logs','health','qa'], write_capability: ['execute'], approval_required: true },
    };
  }
  getAll() { return Object.entries(this.projects).map(([id, p]) => ({ id, ...p })); }
  get(id) { return this.projects[id] || null; }
  getStatus(id) {
    const p = this.get(id);
    if (!p) return { error: 'Project not found' };
    if (p.type === 'remote') {
      const cp = path.join(process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global', 'visibility', id + '.json');
      if (fs.existsSync(cp)) { try { return JSON.parse(fs.readFileSync(cp, 'utf-8')).data; } catch { return { error: 'Cache corrupted' }; } }
      return { status: 'no_cache', message: 'Remote project not synced yet' };
    }
    if (!fs.existsSync(p.local_path)) return { status: 'offline', message: 'Local path not found' };
    return { status: 'ok', name: p.name, path: p.local_path };
  }
  detectProject(msg) {
    const m = msg.toLowerCase();
    if (/raw.*sushi|rawsushi/i.test(m)) return 'raw-website';
    if (/bakudan.*web|bakudanramen/i.test(m)) return 'bakudan-website';
    if (/dashboard/i.test(m)) return 'dashboard';
    if (/integration/i.test(m)) return 'integration-system';
    if (/whatsapp/i.test(m)) return 'whatsapp-api';
    return null;
  }
  detectAction(msg) {
    const m = msg.toLowerCase();
    if (/create.*task|tạo task/i.test(m)) return 'task';
    if (/run.*qa|qa.*test/i.test(m)) return 'qa';
    if (/schedule.*post|lên lịch/i.test(m)) return 'schedule-post';
    if (/đổi giá|change.*price/i.test(m)) return 'update-price';
    return 'status';
  }
  answer(cmd) {
    const pid = this.detectProject(cmd);
    if (!pid) return 'Em khong nhan dang duoc project. Thu: Check Dashboard, Check Raw website.';
    const status = this.getStatus(pid);
    const action = this.detectAction(cmd);
    if (status.error) return 'Loi: ' + status.error;
    if (action === 'task') return 'Tao task cho ' + this.projects[pid].name + ': Da tao draft — cho approval.';
    if (action === 'qa') return 'QA cho ' + this.projects[pid].name + ': Can runner setup.';
    return this.projects[pid].name + ': ' + status.status;
  }
}
export const projectConnector = new ProjectConnector();
